// Weapons: fists and four guns, soft auto-aim, hitscan, tracers, drive-bys, and NPC return fire.

export const WEAPONS = [{
        id: 'fists',
        name: 'Fists',
        dmg: 14,
        rate: 2.5,
        range: 2,
        spread: 0,
        pellets: 1
    },
    {
        id: 'pistol',
        name: 'Vesper 9',
        dmg: 28,
        rate: 3.5,
        range: 55,
        spread: 0.02,
        pellets: 1,
        price: 600,
        ammoPrice: 80,
        clip: 48
    },
    {
        id: 'smg',
        name: 'Mako SMG',
        dmg: 14,
        rate: 11,
        range: 45,
        spread: 0.05,
        pellets: 1,
        price: 2400,
        ammoPrice: 160,
        clip: 150
    },
    {
        id: 'shotgun',
        name: 'Breaker 12',
        dmg: 12,
        rate: 1.2,
        range: 22,
        spread: 0.12,
        pellets: 7,
        price: 3800,
        ammoPrice: 200,
        clip: 30
    },
    {
        id: 'rifle',
        name: 'Kestrel AR',
        dmg: 24,
        rate: 7,
        range: 85,
        spread: 0.025,
        pellets: 1,
        price: 7500,
        ammoPrice: 300,
        clip: 180
    },
];

export class Combat {
    constructor(G) {
        this.G = G;
        this.cool = 0;
        this.index = 1;
        this.owned = {
            fists: true,
            pistol: true
        };
        this.ammo = {
            pistol: 72
        };
    }
    current() {
        return WEAPONS[this.index];
    }
    give(id, ammo) {
        this.owned[id] = true;
        this.ammo[id] = (this.ammo[id] || 0) + ammo;
    }
    cycle(d) {
        for (let i = 1; i <= WEAPONS.length; i++) {
            const k = (this.index + d * i + WEAPONS.length * 5) % WEAPONS.length;
            if (this.owned[WEAPONS[k].id]) {
                this.index = k;
                this.G.hud ? .toast(WEAPONS[k].name);
                return;
            }
        }
    }

    update(dt) {
        const G = this.G,
            I = G.input,
            P = G.player;
        this.cool -= dt;
        if (I.wheel) this.cycle(Math.sign(I.wheel));
        if (I.pressed('KeyQ')) this.cycle(-1);
        if (I.pressed('KeyE') && !G.economy.nearShop()) this.cycle(1);
        for (let n = 1; n <= 5; n++)
            if (I.pressed('Digit' + n) && this.owned[WEAPONS[n - 1].id]) this.index = n - 1;
        if (P.dead || !I.mouse.left || this.cool > 0) return;
        let w = this.current();
        if (P.vehicle && w.id === 'fists') w = WEAPONS[1];
        if (w.id !== 'fists' && !(this.ammo[w.id] > 0)) {
            if (I.mouse.leftPressed) G.audio ? .click();
            return;
        }
        this.cool = 1 / w.rate;
        if (w.id !== 'fists') this.ammo[w.id]--;
        this.fire(w);
    }

    // Best target in a cone around the aim direction, nearest-angle first.
    pickTarget(ox, oz, ax, az, range, cone = 0.32) {
        const G = this.G;
        let best = null,
            bs = cone;
        const cands = [...G.peds.filter((p) => !p.dead && p.role !== 'npc'), ...G.vehicles.filter((v) => !v.dead && v !== G.player.vehicle && (v.role === 'police' || v.driver === 'ai'))];
        for (const t of cands) {
            const dx = t.x - ox,
                dz = t.z - oz,
                d = Math.hypot(dx, dz);
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

    fire(w) {
        const G = this.G,
            P = G.player,
            [ax, az] = G.cam.forward();
        const ox = P.x + ax * 0.6,
            oz = P.z + az * 0.6,
            oy = P.vehicle ? 1.5 : 1.45;
        if (w.id === 'fists') {
            G.audio ? .punch();
            const t = this.pickTarget(P.x, P.z, ax, az, w.range, 0.9);
            if (t && t.hurt) {
                t.hurt(w.dmg, true);
                G.wanted.crime(t.role === 'cop' ? 'hitCop' : 'assault', t.x, t.z);
            }
            return;
        }
        const target = this.pickTarget(ox, oz, ax, az, w.range);
        G.audio ? .gunshot(w.id);
        G.fx.muzzle(ox, oy, oz);
        G.cam.addShake(w.id === 'shotgun' ? 0.35 : 0.08);
        if (!target || target.role !== 'gang') {
            G.pedSystem.panic(P.x, P.z, 35);
            G.wanted.crime('gunfire', P.x, P.z);
        }
        for (let i = 0; i < w.pellets; i++) {
            let ex, ez, ey = 1.2;
            const sp = (Math.random() - 0.5) * w.spread * 2;
            if (target && Math.random() < 0.9 - Math.abs(sp) * 2) {
                ex = target.x + (Math.random() - 0.5) * 0.4;
                ez = target.z + (Math.random() - 0.5) * 0.4;
                ey = target.spec ? 0.9 : 1.3;
                if (target.hurt) {
                    target.hurt(w.dmg, true);
                    if (target.role === 'cop') G.wanted.crime('hitCop', target.x, target.z);
                } else {
                    target.damage(w.dmg * 0.6);
                    if (target.role === 'police') G.wanted.crime('hitCop', target.x, target.z);
                    if (target.driver === 'ai') target.panic = 6;
                }
                G.fx.sparks(ex, ey, ez, 3);
            } else {
                const c = Math.cos(sp),
                    s = Math.sin(sp),
                    dx = ax * c - az * s,
                    dz = ax * s + az * c;
                const hit = Math.min(w.range, G.collision.ray(ox, oz, dx, dz, w.range));
                ex = ox + dx * hit;
                ez = oz + dz * hit;
                if (hit < w.range) G.fx.sparks(ex, ey, ez, 4);
            }
            G.fx.tracer(ox, oy, oz, ex, ey, ez, 0xffd27a);
        }
    }

    // An NPC's shot at the player: a tracer, a sound, and damage on a hit.
    npcShoot(src, P, acc, dmg) {
        const G = this.G,
            sy = src.y ? ? 1.45,
            hit = Math.random() < acc;
        const ex = P.x + (hit ? 0 : (Math.random() - 0.5) * 4),
            ez = P.z + (hit ? 0 : (Math.random() - 0.5) * 4);
        G.fx.tracer(src.x, sy, src.z, ex, 1.2, ez, 0xff9a6a);
        G.fx.muzzle(src.x - Math.sin(src.heading) * 0.6, sy, src.z - Math.cos(src.heading) * 0.6);
        G.audio ? .gunshot('npc', Math.hypot(src.x - P.x, src.z - P.z));
        if (hit) P.hurt(dmg);
    }
}