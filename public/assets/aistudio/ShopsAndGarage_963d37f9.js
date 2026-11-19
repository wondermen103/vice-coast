// ShopsAndGarage: money, Tidewater Arms gun shop, Sully's garage upgrades/respray, safehouse, cash drops.
import * as THREE from 'three';
import {
    PLACES
} from '../missions/StoryMissions.js';
import {
    WEAPONS
} from '../combat/Weapons.js';
import {
    PAINTS
} from '../vehicles/CarModels.js';
import {
    glowTexture
} from '../render/Textures.js';
import {
    formatMoney
} from '../core/MathUtil.js';

export class Economy {
    constructor(G) {
        this.G = G;
        this.money = 0;
        this.unlocked = new Set(['pistol']);
        this.drops = [];
        this.open = null;
        this.icons = ['guns', 'sully', 'safehouse'].map((k) => {
            const s = new THREE.Sprite(new THREE.SpriteMaterial({
                map: glowTexture(),
                color: k === 'guns' ? 0xff6040 : k === 'sully' ? 0x40ff9a : 0xffffff,
                blending: THREE.AdditiveBlending,
                depthWrite: false
            }));
            s.position.set(PLACES[k][0], 1.4, PLACES[k][1]);
            s.scale.setScalar(2.4);
            G.scene.add(s);
            return s;
        });
    }

    earn(n) {
        this.money += n;
        this.G.hud ? .moneyPop(n);
    }
    spend(n) {
        if (this.money < n) {
            this.G.hud.toast('Not enough cash', 'bad');
            this.G.audio ? .click();
            return false;
        }
        this.money -= n;
        this.G.audio ? .cash();
        return true;
    }
    unlock(k) {
        this.unlocked.add(k);
        if (k !== 'garage') this.G.hud.toast(WEAPONS.find((w) => w.id === k) ? .name + ' now at Tidewater Arms', 'good');
        else this.G.hud.toast("Sully's garage unlocked", 'good');
    }

    dropCash(x, z, n) {
        const s = new THREE.Sprite(new THREE.SpriteMaterial({
            map: glowTexture(),
            color: new THREE.Color(0.4, 2.2, 0.6),
            blending: THREE.AdditiveBlending,
            depthWrite: false
        }));
        s.position.set(x, 0.5, z);
        s.scale.setScalar(1.1);
        this.G.scene.add(s);
        this.drops.push({
            x,
            z,
            n,
            s,
            t: 30
        });
    }

    nearShop() {
        const P = this.G.player;
        for (const k of ['guns', 'sully', 'safehouse'])
            if (Math.hypot(PLACES[k][0] - P.x, PLACES[k][1] - P.z) < 5) return k;
        return null;
    }

    update(dt) {
        const G = this.G,
            P = G.player;
        for (let i = this.drops.length - 1; i >= 0; i--) {
            const d = this.drops[i];
            d.t -= dt;
            d.s.position.y = 0.5 + Math.sin(d.t * 4) * 0.15;
            if (Math.hypot(d.x - P.x, d.z - P.z) < 1.8 || d.t <= 0) {
                if (d.t > 0) {
                    this.earn(d.n);
                    G.audio ? .cash();
                }
                G.scene.remove(d.s);
                this.drops.splice(i, 1);
            }
        }
        const k = this.nearShop();
        if (k && !this.open) G.hud.hint('Press E · ' + PLACES[k][2]);
        if (k && G.input.pressed('KeyE') && !this.open) this.show(k);
        if (this.open && (G.input.pressed('Escape') || G.input.pressed('Backspace') || !k)) this.close();
        if (this.open)
            for (let n = 1; n <= 6; n++)
                if (G.input.pressed('Digit' + n)) this.buy(n - 1);
    }

    items(k) {
        const G = this.G,
            v = G.player.vehicle;
        if (k === 'guns') {
            const out = WEAPONS.filter((w) => w.price && (this.unlocked.has(w.id) || this.unlocked.has(w.id))).map((w) => G.combat.owned[w.id] ?
                {
                    label: w.name + ' ammo (+' + w.clip + ')',
                    price: w.ammoPrice,
                    act: () => G.combat.give(w.id, w.clip)
                } :
                {
                    label: 'Buy ' + w.name,
                    price: w.price,
                    act: () => G.combat.give(w.id, w.clip)
                });
            out.push({
                label: 'Body armour',
                price: 500,
                act: () => {
                    G.player.armor = 100;
                }
            });
            return out;
        }
        if (k === 'sully') {
            if (!this.unlocked.has('garage')) return [{
                label: 'Sully is busy (story mission 2)',
                price: 0,
                act: () => {}
            }];
            if (!v) return [{
                label: 'Drive a car in first',
                price: 0,
                act: () => {}
            }];
            return [{
                    label: 'Repair',
                    price: 300,
                    act: () => {
                        v.health = v.maxHealth;
                    }
                },
                {
                    label: 'Respray (loses unseen heat)',
                    price: 450,
                    act: () => {
                        v.paintMat.color.set(PAINTS[(PAINTS.indexOf(v.paint) + 1 + PAINTS.length) % PAINTS.length]);
                        if (!G.wanted.seen) G.wanted.clear();
                    }
                },
                {
                    label: 'Engine tune',
                    tier: [v.upgrade],
                    price: 2000 * (v.upgrade + 1),
                    act: () => {
                        v.upgrade = Math.min(3, v.upgrade + 1);
                    }
                },
                {
                    label: 'Armour plating',
                    tier: [v.armor],
                    price: 1500 * (v.armor + 1),
                    act: () => {
                        v.armor = Math.min(3, v.armor + 1);
                    }
                },
            ];
        }
        return [{
            label: 'Save game and rest',
            price: 0,
            act: () => {
                G.save.save();
                G.player.health = 100;
                G.sky.hour = (G.sky.hour + 6) % 24;
            }
        }];
    }

    // the garage card: the car's stats now, and (lighter) after the next engine/armour tier
    card() {
        const v = this.G.player.vehicle;
        if (!v || !this.unlocked.has('garage')) return null;
        const s = v.spec,
            u = Math.min(3, v.upgrade + 1),
            a = Math.min(3, v.armor + 1);
        return {
            name: s.name,
            stats: [
                ['Top speed', s.top * (1 + v.upgrade * 0.12) / 90, s.top * (1 + u * 0.12) / 90],
                ['Acceleration', s.acc * (1 + v.upgrade * 0.15) / 26, s.acc * (1 + u * 0.15) / 26],
                ['Armour', 0.2 + v.armor * 0.25, 0.2 + a * 0.25],
                ['Handling', s.grip / 10, s.grip / 10],
            ]
        };
    }

    show(k) {
        this.open = k;
        this.G.menus.shop(PLACES[k][2], this.items(k), k === 'sully' ? this.card() : null);
    }
    buy(i) {
        const it = this.items(this.open)[i];
        if (!it) return;
        if (it.price && !this.spend(it.price)) return;
        it.act();
        this.G.hud.toast(it.label + (it.price ? ' · -' + formatMoney(it.price) : ''), 'good');
        this.show(this.open);
    }
    close() {
        this.open = null;
        this.G.menus.closeShop();
    }
}