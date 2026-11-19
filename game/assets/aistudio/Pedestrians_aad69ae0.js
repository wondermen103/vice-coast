// Pedestrians: sidewalk civilians who panic and flee, run-overs, and armed gang members and officers.
import {
    buildPerson,
    animatePerson,
    randomLook
} from './PersonModel.js';
import {
    Rng,
    clamp,
    wrapAngle,
    damp
} from '../core/MathUtil.js';
import {
    lots,
    SIZE,
    ROAD
} from '../world/CityLayout.js';

const RINGS = lots().map((l) => ({
    x0: l.x0 + 1.8,
    z0: l.z0 + 1.8,
    x1: l.x1 - 1.8,
    z1: l.z1 - 1.8
}));
RINGS.push({
    x0: -ROAD / 2 - 4.8,
    z0: -30,
    x1: -ROAD / 2 - 1.4,
    z1: SIZE + 30
}); // Malecón promenade

export class Ped {
    constructor(G, look, x, z, role = 'civ') {
        this.G = G;
        this.rig = buildPerson(look);
        this.look = look;
        this.x = x;
        this.z = z;
        this.heading = 0;
        this.role = role;
        this.health = role === 'civ' ? 30 : role === 'cop' ? 70 : 60;
        this.dead = false;
        this.deadTime = 0;
        this.state = role === 'civ' ? 'walk' : 'guard';
        this.phase = Math.random() * 6;
        this.speed = 0;
        this.fireCd = 1 + Math.random();
        this.aim = false;
        this.fleeT = 0;
        this.cash = Math.floor(Math.random() * 60) + 10;
        G.scene.add(this.rig.root);
        this.sync(0);
    }
    hurt(n, byPlayer) {
        if (this.dead) return;
        this.health -= n;
        this.G.fx ? .blood(this.x, 1.2, this.z);
        if (this.role === 'civ') {
            this.state = 'flee';
            this.fleeT = 10;
            this.threat = [this.G.player.x, this.G.player.z];
        } else this.state = 'attack';
        if (this.health <= 0) {
            this.dead = true;
            this.state = 'dead';
            this.rig.gun.visible = false;
            this.G.events.emit('pedKilled', {
                ped: this,
                byPlayer
            });
            if (this.role !== 'npc') this.G.economy ? .dropCash(this.x, this.z, this.role === 'gang' ? 120 + Math.floor(Math.random() * 200) : this.cash);
        }
    }
    sync(dt) {
        this.rig.root.position.set(this.x, 0, this.z);
        this.rig.root.rotation.y = this.heading;
        const mode = this.dead ? 'dead' : this.speed > 3.2 ? 'run' : this.speed > 0.3 ? 'walk' : 'idle';
        animatePerson(this.rig, this.phase, mode, this.aim && !this.dead, dt);
    }
    dispose() {
        this.G.scene.remove(this.rig.root);
    }
}

export class PedSystem {
    constructor(G) {
        this.G = G;
        G.peds = [];
        this.rng = new Rng(99);
        this.target = 40;
    }

    spawnCiv(px, pz) {
        const r = this.rng;
        for (let t = 0; t < 12; t++) {
            const ring = RINGS[r.int(0, RINGS.length - 1)],
                side = r.int(0, 3);
            const u = r.next();
            const x = side === 0 ? ring.x0 : side === 1 ? ring.x1 : ring.x0 + (ring.x1 - ring.x0) * u;
            const z = side >= 2 ? (side === 2 ? ring.z0 : ring.z1) : ring.z0 + (ring.z1 - ring.z0) * u;
            const d = Math.hypot(x - px, z - pz);
            if (d < 40 || d > 130) continue;
            return this.addCiv(x, z, ring);
        }
        return null;
    }
    addCiv(x, z, ring) {
        const p = new Ped(this.G, randomLook(this.rng), x, z, 'civ');
        p.ring = ring || RINGS.reduce((b, rr) => (Math.hypot((rr.x0 + rr.x1) / 2 - x, (rr.z0 + rr.z1) / 2 - z) < Math.hypot((b.x0 + b.x1) / 2 - x, (b.z0 + b.z1) / 2 - z) ? rr : b));
        p.cw = this.rng.chance(0.5);
        p.walkSpeed = this.rng.range(1.1, 1.7);
        this.G.peds.push(p);
        return p;
    }
    addArmed(x, z, role, look) {
        const p = new Ped(this.G, look, x, z, role);
        p.weaponDmg = role === 'cop' ? 7 : 6;
        p.accuracy = role === 'cop' ? 0.45 : 0.35;
        p.home = [x, z];
        this.G.peds.push(p);
        return p;
    }

    // Next corner of the sidewalk ring the civilian walks around.
    corner(p) {
        const r = p.ring,
            pts = [
                [r.x0, r.z0],
                [r.x1, r.z0],
                [r.x1, r.z1],
                [r.x0, r.z1]
            ];
        if (p.ci === undefined) p.ci = pts.reduce((bi, q, i) => (Math.hypot(q[0] - p.x, q[1] - p.z) < Math.hypot(pts[bi][0] - p.x, pts[bi][1] - p.z) ? i : bi), 0);
        const q = pts[p.ci];
        if (Math.hypot(q[0] - p.x, q[1] - p.z) < 1) p.ci = (p.ci + (p.cw ? 1 : 3)) % 4;
        return pts[p.ci];
    }

    panic(x, z, radius) {
        for (const p of this.G.peds)
            if (p.role === 'civ' && !p.dead && Math.hypot(p.x - x, p.z - z) < radius) {
                p.state = 'flee';
                p.fleeT = 8 + Math.random() * 4;
                p.threat = [x, z];
            }
        for (const v of this.G.vehicles)
            if (v.role === 'traffic' && Math.hypot(v.x - x, v.z - z) < radius) v.panic = 6;
    }

    update(dt) {
        const G = this.G,
            P = G.player,
            col = G.collision;
        let civs = 0;
        for (let i = G.peds.length - 1; i >= 0; i--) {
            const p = G.peds[i],
                d = Math.hypot(p.x - P.x, p.z - P.z);
            if (p.role === 'civ') civs++;
            if ((p.role === 'civ' && d > 170) || (p.dead && (p.deadTime += dt) > 25 && d > 30)) {
                p.dispose();
                G.peds.splice(i, 1);
                continue;
            }
            if (d > 190) continue;
            if (!p.dead) this.think(p, dt, P);
            // run-overs
            if (!p.dead)
                for (const v of G.vehicles) {
                    if (Math.abs(v.speed) < 4 || Math.hypot(v.x - p.x, v.z - p.z) > 2.1) continue;
                    p.hurt(Math.abs(v.speed) * 4, v === P.vehicle);
                    if (!p.dead) {
                        p.x += v.fx * 2.5;
                        p.z += v.fz * 2.5;
                    }
                    G.audio ? .thud();
                    v.speed *= 0.9;
                }
            if (!p.dead) {
                const r = col.resolve(p.x, p.z, 0.35);
                p.x = r.x;
                p.z = r.z;
            }
            p.phase += dt * p.speed * 4.2;
            p.sync(dt);
        }
        if (civs < this.target) this.spawnCiv(P.x, P.z);
    }

    think(p, dt, P) {
        let tx = p.x,
            tz = p.z,
            spd = 0;
        if (p.role === 'civ') {
            if (p.state === 'flee') {
                p.fleeT -= dt;
                if (p.fleeT <= 0) {
                    p.state = 'walk';
                    p.ci = undefined;
                }
                const ax = p.x - p.threat[0],
                    az = p.z - p.threat[1],
                    l = Math.hypot(ax, az) || 1;
                tx = p.x + ax / l * 5;
                tz = p.z + az / l * 5;
                spd = 5.2;
            } else {
                [tx, tz] = this.corner(p);
                spd = p.walkSpeed;
            }
            p.aim = false;
        } else if (p.role === 'npc') { // companion follows the player on foot
            if (p.follow && !P.vehicle) {
                const d = Math.hypot(P.x - p.x, P.z - p.z);
                if (d > 2.5) {
                    tx = P.x;
                    tz = P.z;
                    spd = d > 6 ? 5 : 2.2;
                }
            }
        } else this.fight(p, dt, P, (x, z, s) => {
            tx = x;
            tz = z;
            spd = s;
        });
        const dx = tx - p.x,
            dz = tz - p.z,
            l = Math.hypot(dx, dz);
        if (l > 0.2 && spd > 0) {
            p.heading = p.aim ? p.heading : damp(p.heading, p.heading + wrapAngle(Math.atan2(-dx, -dz) - p.heading), 8, dt);
            p.x += dx / l * spd * dt;
            p.z += dz / l * spd * dt;
        }
        p.speed = l > 0.2 ? spd : 0;
    }

    // Gang members and officers: close in to firing range, hold distance, shoot when they can see.
    fight(p, dt, P, move) {
        const d = Math.hypot(P.x - p.x, P.z - p.z),
            G = this.G;
        if (p.state === 'guard') {
            p.aim = false;
            if (d < 38 || (p.role === 'cop' && G.wanted.level > 0)) p.state = 'attack';
            return move(p.x, p.z, 0);
        }
        if (P.dead) {
            p.aim = false;
            return move(p.x, p.z, 0);
        }
        const face = Math.atan2(-(P.x - p.x), -(P.z - p.z));
        p.heading = face;
        p.aim = d < 34;
        if (p.role === 'cop' && d < 2.2 && !P.vehicle) G.police.bustProgress(dt * 1.5);
        const want = p.role === 'cop' && !P.vehicle && G.wanted.level <= 2 ? 1.5 : 11;
        if (d > want + 2) move(P.x, P.z, d > 20 ? 4.8 : 2.6);
        else if (d < want - 4) move(p.x - (P.x - p.x), p.z - (P.z - p.z), 2.2);
        else move(p.x + Math.cos(face) * 2, p.z + Math.sin(face) * 2, 1.2);
        p.fireCd -= dt;
        if (p.aim && p.fireCd <= 0 && G.collision.clearLine(p.x, p.z, P.x, P.z)) {
            p.fireCd = 0.5 + Math.random() * 0.8;
            G.combat.npcShoot(p, P, clamp(p.accuracy - d * 0.006, 0.08, 0.6), p.weaponDmg);
        }
    }
}