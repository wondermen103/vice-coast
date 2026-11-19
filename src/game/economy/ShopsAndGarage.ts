// ShopsAndGarage: Cash & pickups, Tidewater Arms (including Solstice GL),
// Expanded Sully's Spray & Tune (Finish, Neon Underglow, Nitrous, Engine, Armour), and Safehouse.
import * as THREE from 'three';
import { PLACES } from '../missions/StoryMissions.ts';
import { WEAPONS } from '../combat/Weapons.ts';
import {
  PAINTS,
  UNDERGLOW_COLORS,
  type PaintFinish,
} from '../vehicles/CarModels.ts';
import { WEATHER_SPECS, type WeatherMode } from '../core/WeatherRules.ts';
import { formatMoney, pick } from '../core/MathUtil.ts';

export interface ShopMenuItem {
  id: string;
  key: string;
  label: string;
  sub: string;
  price: number;
  disabled?: boolean;
  badge?: string;
}

export interface GaragePreview {
  carName: string;
  speedPct: number;
  accelPct: number;
  armorPct: number;
  nitroTier: number;
  finish: PaintFinish;
  underglowLabel: string;
  paintHex: string;
}

export interface ShopModalState {
  kind: 'guns' | 'garage' | 'safehouse';
  title: string;
  subtitle: string;
  items: ShopMenuItem[];
  garage?: GaragePreview;
}

interface CashDrop {
  x: number;
  z: number;
  amount: number;
  mesh: THREE.Mesh;
  life: number;
}

const FINISH_CYCLE: PaintFinish[] = ['gloss', 'matte', 'pearl'];
const FINISH_LABEL: Record<PaintFinish, string> = {
  gloss: 'Mirror Gloss',
  matte: 'Matte Carbon',
  pearl: 'Iridescent Pearl',
};

export class Economy {
  public money = 2400;
  public sullyFullUnlocked = false;
  public activeShop: 'guns' | 'garage' | 'safehouse' | null = null;
  private drops: CashDrop[] = [];
  private markers: Array<{ kind: 'guns' | 'garage' | 'safehouse'; x: number; z: number; label: string }> = [
    { kind: 'guns', x: PLACES.guns.x, z: PLACES.guns.z, label: 'Tidewater Arms' },
    { kind: 'garage', x: PLACES.sully.x, z: PLACES.sully.z, label: "Sully's Custom Garage" },
    { kind: 'safehouse', x: PLACES.safehouse.x, z: PLACES.safehouse.z, label: 'Bayview Safehouse' },
  ];

  constructor(private G: any) {}

  earn(n: number): void {
    const amt = Math.round(n);
    if (amt <= 0) return;
    this.money += amt;
    this.G.ui?.moneyPop(amt);
  }

  spend(n: number): boolean {
    if (this.money < n) {
      this.G.ui?.toast(`Need ${formatMoney(n)}`, 'bad');
      this.G.audio?.click();
      return false;
    }
    this.money -= n;
    this.G.audio?.buy();
    return true;
  }

  drop(x: number, z: number, amount: number): void {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.65, 0.22, 0.38),
      new THREE.MeshStandardMaterial({
        color: 0x39d98a,
        emissive: 0x16633d,
        emissiveIntensity: 0.7,
        roughness: 0.3,
      }),
    );
    mesh.position.set(x, 0.32, z);
    this.G.scene.add(mesh);
    this.drops.push({ x, z, amount, mesh, life: 45 });
  }

  dropCash(x: number, z: number, amount: number): void {
    this.drop(x, z, amount);
  }

  nearShop(): { kind: 'guns' | 'garage' | 'safehouse'; x: number; z: number; label: string } | null {
    const P = this.G.player;
    for (const m of this.markers) {
      if (Math.hypot(P.x - m.x, P.z - m.z) < 9.5) return m;
    }
    return null;
  }

  buildShopModal(kind: 'guns' | 'garage' | 'safehouse'): ShopModalState {
    const G = this.G;
    const P = G.player;

    if (kind === 'guns') {
      const items: ShopMenuItem[] = [];
      WEAPONS.slice(1).forEach((w, idx) => {
        const owned = !!G.combat.owned[w.id];
        const price = owned ? (w.ammoPrice ?? 120) : (w.price ?? 1000);
        items.push({
          id: `gun:${w.id}`,
          key: String(idx + 1),
          label: owned ? `${w.name} · +${w.clip} Ammo` : `${w.name} (${w.role})`,
          sub: owned
            ? `Current ammo: ${G.combat.ammo[w.id] ?? 0}`
            : `DMG ${w.dmg}${w.pellets > 1 ? `x${w.pellets}` : ''} · Range ${w.range}m`,
          price,
          badge: owned ? 'AMMO' : 'BUY',
        });
      });
      items.push({
        id: 'armor',
        key: '6',
        label: 'Kevlar Vest (Full Armour)',
        sub: `Current armour: ${Math.round(P.armor)}%`,
        price: 550,
        disabled: P.armor >= 99,
        badge: 'GEAR',
      });
      return {
        kind: 'guns',
        title: 'Tidewater Arms',
        subtitle: 'Custom coastal ordnance · Press 1–6 or click to buy',
        items,
      };
    }

    if (kind === 'garage') {
      const v = P.vehicle;
      if (!v) {
        return {
          kind: 'garage',
          title: "Sully's Custom Garage",
          subtitle: 'Drive any vehicle into Sully’s bay to customize paint, finish, underglow & tuning.',
          items: [
            {
              id: 'summon',
              key: '1',
              label: 'Deliver Viper Comet RS to Bay',
              sub: 'Freshly tuned street coupe delivered right here',
              price: 0,
              badge: 'FREE',
            },
          ],
        };
      }
      const nextFinish =
        FINISH_CYCLE[(FINISH_CYCLE.indexOf(v.finish) + 1) % FINISH_CYCLE.length];
      const nextGlow =
        UNDERGLOW_COLORS[(v.underglowIdx + 1) % UNDERGLOW_COLORS.length];

      const items: ShopMenuItem[] = [
        {
          id: 'repair',
          key: '1',
          label: 'Full Body Repair & Heat Clear',
          sub: 'Restores 100% hull & drops all VCPD stars',
          price: 350,
          badge: 'SERVICE',
        },
        {
          id: 'respray',
          key: '2',
          label: 'Custom Respray & Heat Clear',
          sub: 'Fresh Vice Coast lacquer + clears VCPD heat',
          price: 400,
          badge: 'PAINT',
        },
        {
          id: 'finish',
          key: '3',
          label: `Paint Finish → ${FINISH_LABEL[nextFinish]}`,
          sub: `Current: ${FINISH_LABEL[v.finish as PaintFinish]} (Gloss / Matte Carbon / Pearl)`,
          price: 650,
          badge: 'STYLE',
        },
        {
          id: 'underglow',
          key: '4',
          label: `Neon Underglow → ${nextGlow.label}`,
          sub: `Current: ${UNDERGLOW_COLORS[v.underglowIdx]?.label ?? 'Off'}`,
          price: 500,
          badge: 'NEON',
        },
        {
          id: 'nitro',
          key: '5',
          label:
            v.nitroTier >= 3
              ? 'Nitrous Injection (MAX TIER 3)'
              : `Nitrous Kit · Tier ${v.nitroTier + 1}/3`,
          sub: 'Higher top boost speed & faster drift recharge [SHIFT]',
          price: 900 * (v.nitroTier + 1),
          disabled: v.nitroTier >= 3,
          badge: 'BOOST',
        },
        {
          id: 'engine',
          key: '6',
          label:
            v.upgrade >= 3
              ? 'Twin-Turbo Engine (MAX TIER 3)'
              : `Engine Tune · Tier ${v.upgrade + 1}/3`,
          sub: '+12% Top Speed & +15% Acceleration per tier',
          price: 1200 * (v.upgrade + 1),
          disabled: v.upgrade >= 3,
          badge: 'PERF',
        },
        {
          id: 'varmor',
          key: '7',
          label:
            v.armor >= 3
              ? 'Chassis Armour (MAX TIER 3)'
              : `Armour Plating · Tier ${v.armor + 1}/3`,
          sub: '-20% incoming vehicle damage per tier',
          price: 1100 * (v.armor + 1),
          disabled: v.armor >= 3,
          badge: 'ARMOR',
        },
      ];

      return {
        kind: 'garage',
        title: "Sully's Custom Garage",
        subtitle: `${v.spec.name} in bay · Press 1–7 or click to install`,
        items,
        garage: {
          carName: v.spec.name,
          speedPct: Math.min(100, Math.round(((v.spec.top * (1 + v.upgrade * 0.12)) / 92) * 100)),
          accelPct: Math.min(100, Math.round(((v.spec.acc * (1 + v.upgrade * 0.15)) / 28) * 100)),
          armorPct: Math.min(100, Math.round(25 + v.armor * 25)),
          nitroTier: v.nitroTier,
          finish: v.finish,
          underglowLabel: UNDERGLOW_COLORS[v.underglowIdx]?.label ?? 'Off',
          paintHex: v.paint,
        },
      };
    }

    // Safehouse
    const weathers: WeatherMode[] = ['golden', 'storm', 'midnight', 'noon'];
    return {
      kind: 'safehouse',
      title: 'Bayview Safehouse',
      subtitle: 'Save progress, recover health, or set Vice Coast atmosphere',
      items: [
        {
          id: 'save',
          key: '1',
          label: 'Save Game & Rest (+100% Health)',
          sub: 'Writes progress to browser storage & heals Nick',
          price: 0,
          badge: 'SAVE',
        },
        ...weathers.map((w, i) => ({
          id: `weather:${w}`,
          key: String(i + 2),
          label: `Set Atmosphere · ${WEATHER_SPECS[w].label}`,
          sub:
            w === 'storm'
              ? 'Heavy rain, lightning & wet glossy roads'
              : w === 'midnight'
                ? 'Neon skyline, light drizzle & night reflections'
                : w === 'noon'
                  ? 'Bright coastal sun & crisp beachfront shadows'
                  : 'Warm low-sun sunset glow over Ocean Drive',
          price: 0,
          badge: G.sky.weather === w ? 'ACTIVE' : 'SET',
        })),
      ],
    };
  }

  openShop(kind: 'guns' | 'garage' | 'safehouse'): void {
    this.activeShop = kind;
    this.G.ui.openShop(this.buildShopModal(kind));
  }

  closeShop(): void {
    this.activeShop = null;
    this.G.ui.closeShop();
  }

  selectShopItem(itemId: string): void {
    const G = this.G;
    const P = G.player;

    if (itemId.startsWith('gun:')) {
      const id = itemId.slice(4);
      const w = WEAPONS.find((x) => x.id === id);
      if (!w) return;
      const owned = !!G.combat.owned[id];
      const price = owned ? (w.ammoPrice ?? 120) : (w.price ?? 1000);
      if (!this.spend(price)) return;
      G.combat.give(id, w.clip ?? 30);
      G.combat.index = WEAPONS.findIndex((x) => x.id === id);
      G.ui.toast(`${w.name} Ready`, 'good');
    } else if (itemId === 'armor') {
      if (P.armor >= 99) return;
      if (!this.spend(550)) return;
      P.armor = 100;
      G.ui.toast('Kevlar Vest Equipped', 'good');
    } else if (itemId === 'summon') {
      G.callPersonalCar(PLACES.sully.x + 8, PLACES.sully.z + 2);
      this.closeShop();
      return;
    } else if (itemId === 'repair' && P.vehicle) {
      if (!this.spend(350)) return;
      P.vehicle.health = P.vehicle.maxHealth;
      G.wanted.clear();
      G.ui.toast('Chassis Repaired · Heat Cleared', 'good');
    } else if (itemId === 'respray' && P.vehicle) {
      if (!this.spend(400)) return;
      const nextColor = pick(PAINTS.filter((c) => c !== P.vehicle.paint));
      P.vehicle.paint = nextColor;
      P.vehicle.paintMat.color.set(nextColor);
      P.vehicle.health = P.vehicle.maxHealth;
      G.wanted.clear();
      G.ui.toast('Fresh Paint · VCPD Heat Cleared', 'good');
    } else if (itemId === 'finish' && P.vehicle) {
      if (!this.spend(650)) return;
      const next =
        FINISH_CYCLE[(FINISH_CYCLE.indexOf(P.vehicle.finish) + 1) % FINISH_CYCLE.length];
      P.vehicle.setFinish(next);
      G.ui.toast(`Finish Installed · ${FINISH_LABEL[next]}`, 'good');
    } else if (itemId === 'underglow' && P.vehicle) {
      if (!this.spend(500)) return;
      const nextIdx = (P.vehicle.underglowIdx + 1) % UNDERGLOW_COLORS.length;
      const next = UNDERGLOW_COLORS[nextIdx];
      P.vehicle.setUnderglow(next.color, nextIdx);
      G.ui.toast(`Underglow · ${next.label}`, 'good');
    } else if (itemId === 'nitro' && P.vehicle && P.vehicle.nitroTier < 3) {
      const price = 900 * (P.vehicle.nitroTier + 1);
      if (!this.spend(price)) return;
      P.vehicle.nitroTier++;
      P.stunt.nitro = 100;
      G.ui.toast(`Nitrous Kit Tier ${P.vehicle.nitroTier} Installed`, 'good');
    } else if (itemId === 'engine' && P.vehicle && P.vehicle.upgrade < 3) {
      const price = 1200 * (P.vehicle.upgrade + 1);
      if (!this.spend(price)) return;
      P.vehicle.upgrade++;
      G.ui.toast(`Twin-Turbo Tier ${P.vehicle.upgrade} Installed`, 'good');
    } else if (itemId === 'varmor' && P.vehicle && P.vehicle.armor < 3) {
      const price = 1100 * (P.vehicle.armor + 1);
      if (!this.spend(price)) return;
      P.vehicle.armor++;
      G.ui.toast(`Armour Plating Tier ${P.vehicle.armor} Installed`, 'good');
    } else if (itemId === 'save') {
      P.health = 100;
      G.save?.save();
      G.ui.toast('Game Saved & Health Restored', 'good');
    } else if (itemId.startsWith('weather:')) {
      const w = itemId.slice(8) as WeatherMode;
      G.sky.setWeather(w);
      G.ui.toast(`Atmosphere · ${WEATHER_SPECS[w].label}`, 'good');
    }

    if (this.activeShop) {
      this.G.ui.openShop(this.buildShopModal(this.activeShop));
    }
  }

  update(dt: number): void {
    const G = this.G;
    const P = G.player;

    // Collect cash drops
    for (let i = this.drops.length - 1; i >= 0; i--) {
      const d = this.drops[i];
      d.life -= dt;
      d.mesh.rotation.y += dt * 2.5;
      if (Math.hypot(d.x - P.x, d.z - P.z) < 2.6) {
        this.earn(d.amount);
        G.audio?.pickup();
        G.scene.remove(d.mesh);
        this.drops.splice(i, 1);
        continue;
      }
      if (d.life <= 0) {
        G.scene.remove(d.mesh);
        this.drops.splice(i, 1);
      }
    }

    if (this.activeShop) return;
    const near = this.nearShop();
    if (near) {
      G.ui.hint(`Press E · Enter ${near.label}`);
      if (G.input.pressed('KeyE')) {
        this.openShop(near.kind);
      }
    }
  }
}
