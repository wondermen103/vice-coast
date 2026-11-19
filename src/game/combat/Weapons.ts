// Weapons: 6-weapon arsenal (Fists, Vesper 9, Mako SMG, Breaker 12, Kestrel AR, Solstice GL explosive launcher),
// soft auto-aim, hitmarkers, splash blast, tracers, drive-bys, and NPC return fire.

export interface WeaponDef {
  id: string;
  name: string;
  role: string;
  dmg: number;
  rate: number;
  range: number;
  spread: number;
  pellets: number;
  explosive?: boolean;
  price?: number;
  ammoPrice?: number;
  clip?: number;
}

export const WEAPONS: readonly WeaponDef[] = [
  {
    id: 'fists',
    name: 'Fists',
    role: 'Melee',
    dmg: 16,
    rate: 2.5,
    range: 2.2,
    spread: 0,
    pellets: 1,
  },
  {
    id: 'pistol',
    name: 'Vesper 9',
    role: 'Sidearm',
    dmg: 28,
    rate: 3.6,
    range: 55,
    spread: 0.02,
    pellets: 1,
    price: 600,
    ammoPrice: 80,
    clip: 48,
  },
  {
    id: 'smg',
    name: 'Mako SMG',
    role: 'Rapid Auto',
    dmg: 14,
    rate: 11,
    range: 46,
    spread: 0.048,
    pellets: 1,
    price: 2400,
    ammoPrice: 160,
    clip: 150,
  },
  {
    id: 'shotgun',
    name: 'Breaker 12',
    role: 'Close Spread',
    dmg: 13,
    rate: 1.25,
    range: 24,
    spread: 0.12,
    pellets: 7,
    price: 3800,
    ammoPrice: 200,
    clip: 30,
  },
  {
    id: 'rifle',
    name: 'Kestrel AR',
    role: 'Long Precision',
    dmg: 25,
    rate: 7.2,
    range: 88,
    spread: 0.022,
    pellets: 1,
    price: 7500,
    ammoPrice: 300,
    clip: 180,
  },
  {
    id: 'launcher',
    name: 'Solstice GL',
    role: 'Explosive Blast',
    dmg: 145,
    rate: 0.85,
    range: 65,
    spread: 0.015,
    pellets: 1,
    explosive: true,
    price: 9500,
    ammoPrice: 450,
    clip: 8,
  },
];

export class Combat {
  private cool = 0;
  public index = 1;
  public owned: Record<string, boolean> = { fists: true, pistol: true };
  public ammo: Record<string, number> = { pistol: 72 };

  constructor(private G: any) {}

  current(): WeaponDef {
    return WEAPONS[this.index];
  }

  give(id: string, ammo: number): void {
    this.owned[id] = true;
    this.ammo[id] = (this.ammo[id] || 0) + ammo;
  }

  cycle(d: number): void {
    for (let i = 1; i <= WEAPONS.length; i++) {
      const k = (this.index + d * i + WEAPONS.length * 6) % WEAPONS.length;
      if (this.owned[WEAPONS[k].id]) {
        this.index = k;
        this.G.ui?.toast(`${WEAPONS[k].name} · ${WEAPONS[k].role}`);
        return;
      }
    }
  }

  selectIndex(idx: number): boolean {
    if (idx < 0 || idx >= WEAPONS.length) return false;
    const w = WEAPONS[idx];
    if (!this.owned[w.id]) return false;
    this.index = idx;
    this.G.ui?.toast(`${w.name} · ${w.role}`);
    return true;
  }

  update(dt: number): void {
    const G = this.G;
    const I = G.input;
    const P = G.player;
    this.cool -= dt;
    if (I.wheel) this.cycle(Math.sign(I.wheel));
    if (I.pressed('KeyE') && !G.economy.nearShop()) this.cycle(1);
    for (let n = 1; n <= WEAPONS.length; n++) {
      if (I.pressed('Digit' + n) && this.owned[WEAPONS[n - 1].id]) {
        this.index = n - 1;
      }
    }
    if (P.dead || !I.mouse.left || this.cool > 0) return;

    let w = this.current();
    if (P.vehicle && w.id === 'fists') w = WEAPONS[1];
    if (w.id !== 'fists' && !(this.ammo[w.id] > 0)) {
      if (I.mouse.leftPressed) G.audio?.click();
      return;
    }
    this.cool = 1 / w.rate;
    if (w.id !== 'fists') this.ammo[w.id]--;
    this.fire(w);
  }

  private pickTarget(
    ox: number,
    oz: number,
    ax: number,
    az: number,
    range: number,
    cone = 0.32,
  ): any {
    const G = this.G;
    let best: any = null;
    let bs = cone;
    const cands = [
      ...G.peds.filter((p: any) => !p.dead && p.role !== 'npc'),
      ...G.vehicles.filter(
        (v: any) =>
          !v.dead &&
          v !== G.player.vehicle &&
          (v.role === 'police' || v.role === 'cashvan' || v.driver === 'ai'),
      ),
    ];
    for (const t of cands) {
      const dx = t.x - ox;
      const dz = t.z - oz;
      const d = Math.hypot(dx, dz);
      if (d > range || d < 0.5) continue;
      const ang = Math.acos(Math.max(-1, Math.min(1, (dx * ax + dz * az) / d)));
      const score = ang + d * 0.002 + (t.role === 'civ' ? 0.08 : 0);
      if (score < bs && G.collision.clearLine(ox, oz, t.x, t.z)) {
        bs = score;
        best = t;
      }
    }
    return best;
  }

  private detonateBlast(bx: number, bz: number, dmg: number): void {
    const G = this.G;
    G.fx.explosion(bx, 1, bz);
    G.audio?.explosion();
    G.hitstop = Math.max(G.hitstop || 0, 0.05);
    let hitAny = false;
    for (const p of G.peds) {
      if (p.dead || p.role === 'npc') continue;
      const d = Math.hypot(p.x - bx, p.z - bz);
      if (d < 9.5) {
        p.hurt(dmg * (1 - d / 11), true);
        hitAny = true;
      }
    }
    for (const v of G.vehicles) {
      if (v.dead) continue;
      const d = Math.hypot(v.x - bx, v.z - bz);
      if (d < 10.5) {
        v.damage(dmg * 1.15 * (1 - d / 12));
        hitAny = true;
      }
    }
    if (hitAny) {
      G.ui?.triggerHitmarker();
      G.audio?.hitmarker();
    }
    G.wanted.crime('explosion', bx, bz);
  }

  private fire(w: WeaponDef): void {
    const G = this.G;
    const P = G.player;
    const [ax, az] = G.cam.forward();
    const ox = P.x + ax * 0.6;
    const oz = P.z + az * 0.6;
    const oy = P.vehicle ? 1.5 : 1.45;

    if (w.id === 'fists') {
      G.audio?.punch();
      const t = this.pickTarget(P.x, P.z, ax, az, w.range, 0.9);
      if (t && t.hurt) {
        t.hurt(w.dmg, true);
        G.ui?.triggerHitmarker();
        G.audio?.hitmarker();
        G.wanted.crime(t.role === 'cop' ? 'hitCop' : 'assault', t.x, t.z);
      }
      return;
    }

    const target = this.pickTarget(ox, oz, ax, az, w.range);
    G.audio?.gunshot(w.id);
    G.fx.muzzle(ox, oy, oz);
    G.cam.addShake(w.explosive ? 0.5 : w.id === 'shotgun' ? 0.35 : 0.08);

    if (!target || target.role !== 'gang') {
      G.pedSystem.panic(P.x, P.z, 35);
      G.wanted.crime('gunfire', P.x, P.z);
    }

    if (w.explosive) {
      const hitDist = target
        ? Math.hypot(target.x - ox, target.z - oz)
        : Math.min(w.range, G.collision.ray(ox, oz, ax, az, w.range));
      const bx = target ? target.x : ox + ax * hitDist;
      const bz = target ? target.z : oz + az * hitDist;
      G.fx.tracer(ox, oy, oz, bx, 0.9, bz, 0xff7733);
      this.detonateBlast(bx, bz, w.dmg);
      return;
    }

    let landedHit = false;
    for (let i = 0; i < w.pellets; i++) {
      let ex: number;
      let ez: number;
      let ey = 1.2;
      const sp = (Math.random() - 0.5) * w.spread * 2;
      if (target && Math.random() < 0.9 - Math.abs(sp) * 2) {
        ex = target.x + (Math.random() - 0.5) * 0.4;
        ez = target.z + (Math.random() - 0.5) * 0.4;
        ey = target.spec ? 0.9 : 1.3;
        landedHit = true;
        if (target.hurt) {
          target.hurt(w.dmg, true);
          if (target.role === 'cop') G.wanted.crime('hitCop', target.x, target.z);
        } else {
          target.damage(w.dmg * 0.65);
          if (target.role === 'police') G.wanted.crime('hitCop', target.x, target.z);
          if (target.driver === 'ai') target.panic = 6;
        }
        G.fx.sparks(ex, ey, ez, 3);
      } else {
        const c = Math.cos(sp);
        const s = Math.sin(sp);
        const dx = ax * c - az * s;
        const dz = ax * s + az * c;
        const hit = Math.min(w.range, G.collision.ray(ox, oz, dx, dz, w.range));
        ex = ox + dx * hit;
        ez = oz + dz * hit;
        if (hit < w.range) G.fx.sparks(ex, ey, ez, 4);
      }
      G.fx.tracer(ox, oy, oz, ex, ey, ez, 0xffd27a);
    }

    if (landedHit) {
      G.ui?.triggerHitmarker();
      G.audio?.hitmarker();
    }
  }

  npcShoot(
    src: { x: number; z: number; y?: number; heading: number },
    P: any,
    acc: number,
    dmg: number,
  ): void {
    const G = this.G;
    const sy = src.y ?? 1.45;
    const hit = Math.random() < acc;
    const ex = P.x + (hit ? 0 : (Math.random() - 0.5) * 4);
    const ez = P.z + (hit ? 0 : (Math.random() - 0.5) * 4);
    G.fx.tracer(src.x, sy, src.z, ex, 1.2, ez, 0xff9a6a);
    G.fx.muzzle(
      src.x - Math.sin(src.heading) * 0.6,
      sy,
      src.z - Math.cos(src.heading) * 0.6,
    );
    G.audio?.gunshot('npc', Math.hypot(src.x - P.x, src.z - P.z));
    if (hit) P.hurt(dmg);
  }
}
