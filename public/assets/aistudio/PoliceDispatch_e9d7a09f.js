// PoliceDispatch: PCPD response per star: cruisers, officers on foot, helicopter (3★), roadblocks (4★), tactical van (5★), busted.
import {
    Vehicle
} from '../vehicles/Vehicle.js';
import {
    HelicopterUnit
} from './HelicopterUnit.js';
import {
    lanePoint,
    laneHeading
} from '../traffic/TrafficAI.js';
import {
    Rng,
    clamp,
    wrapAngle
} from '../core/MathUtil.js';
import {
    route,
    nearestRoad,
    GRID,
    SIZE
} from '../world/CityLayout.js';

const COP_LOOK = {
    skin: '#b97850',
    hair: '#111',
    shirt: '#22385e',
    pants: '#14213a',
    shoe: '#111',
    longSleeve: true,
    cap: '#14213a',
    badge: true,
    shades: true
};
const UNITS = [0, 2, 3, 4, 5, 7];
const CALLSIGNS = ['PELICAN', 'BARRACUDA', 'GECKO', 'MANTA', 'OSPREY', 'SNAPPER', 'TOUCAN', 'CORAL'];

export class PoliceDispatch {
    constructor(G) {
        this.G = G;
        this.units = [];
        this.rng = new Rng(911);
        this.blockTimer = 12;
        this.bust = 0;
        this.issued = 0;
        this.heli = new HelicopterUnit(G);
        this.copLook = COP_LOOK;
    }

    spawnCruiser(model = 'police', minD = 80, maxD = 150) {
        const G = this.G,
            P = G.player,
            r = this.rng;
        for (let t = 0; t < 30; t++) {
            const lane = {
                axis: r.chance(0.5) ? 'z' : 'x',
                k: r.int(0, GRID),
                dir: r.chance(0.5) ? 1 : -1
            };
            const [x, z] = lanePoint(lane, r.range(0, SIZE)), d = Math.hypot(x - P.x, z - P.z);
            if (d < minD || d > maxD) continue;
            return this.addUnit(model, x, z, laneHeading(lane));
        }
        return null;
    }

    addUnit(model, x, z, h) {
        const v = new Vehicle(this.G, model, '#ffffff', x, z, h);
        v.role = 'police';
        v.driver = 'police';
        v.siren = true;
        v.stuck = 0;
        v.path = null;
        v.pathT = 0;
        v.fireCd = 1;
        v.deployed = false;
        v.callsign = model === 'swat' ? 'TAC-' + (40 + this.issued % 9) : CALLSIGNS[this.issued % CALLSIGNS.length] + '-' + (11 + (this.issued * 7) % 37);
        this.issued++;
        this.G.vehicles.push(v);
        this.units.push(v);
        return v;
    }

    // What a unit is doing right now, read off the same state the pursuit AI acts on.
    status(u) {
        const G = this.G,
            P = G.player,
            d = Math.hypot(u.x - P.x, u.z - P.z);
        if (u.dead) return 'WRECKED';
        if (u.roadblock) return 'ROADBLOCK';
        if (G.wanted.level === 0) return 'PATROL';
        if (u.deployed) return 'ON FOOT';
        if (!G.collision.clearLine(u.x, u.z, P.x, P.z) || d > 75) return 'SEARCHING';
        if (P.vehicle && d < 13) return 'RAMMING';
        if (G.wanted.level >= 2 && d < 32) return 'FIRING';
        return 'PURSUIT';
    }

    // The dispatch board: every live unit with its callsign, range and status, nearest first, plus Air-1.
    roster() {
        const G = this.G,
            P = G.player;
        const rows = this.units.filter((u) => !u.dead || Math.hypot(u.x - P.x, u.z - P.z) < 60)
            .map((u) => ({
                sign: u.callsign,
                d: Math.hypot(u.x - P.x, u.z - P.z),
                state: this.status(u),
                kind: u.model === 'swat' ? 'van' : 'car'
            }))
            .sort((a, b) => (a.state === 'WRECKED') - (b.state === 'WRECKED') || a.d - b.d);
        if (this.heli.active) rows.splice(Math.min(2, rows.length), 0, {
            sign: 'AIR-1',
            d: Math.hypot(this.heli.x - P.x, this.heli.z - P.z),
            state: this.heli.spotting ? 'SPOTLIGHT' : 'SWEEPING',
            kind: 'heli'
        });
        return rows;
    }

    roadblock() {
        const G = this.G,
            P = G.player,
            v = P.vehicle;
        if (!v) return;
        const ax = P.x + v.fx * 75,
            az = P.z + v.fz * 75,
            rd = nearestRoad(ax, az);
        if (Math.hypot(rd.x - P.x, rd.z - P.z) < 45) return;
        const across = rd.axis === 'z' ? Math.PI / 2 : 0;
        for (const o of [-3.2, 3.2]) {
            const x = rd.axis === 'z' ? rd.x + o : rd.x,
                z = rd.axis === 'z' ? rd.z : rd.z + o;
            const u = this.addUnit('police', x, z, across + (o > 0 ? 0.25 : -0.25));
            u.roadblock = true;
        }
        G.hud ? .toast('PCPD roadblock ahead!', 'bad');
    }

    canSee(x, z) {
        const G = this.G;
        if (this.heli.active && Math.hypot(this.heli.x - x, this.heli.z - z) < 110) return true;
        for (const u of this.units)
            if (!u.dead && Math.hypot(u.x - x, u.z - z) < 75 && G.collision.clearLine(u.x, u.z, x, z)) return true;
        for (const p of G.peds)
            if (p.role === 'cop' && !p.dead && Math.hypot(p.x - x, p.z - z) < 50) return true;
        return false;
    }

    bustProgress(n) {
        this.bust += n;
    }

    update(dt) {
        const G = this.G,
            W = G.wanted,
            P = G.player;
        const live = this.units.filter((u) => !u.dead && !u.roadblock);
        if (W.level > 0 && live.length < UNITS[W.level] && this.rng.chance(dt * 1.2)) this.spawnCruiser(W.level >= 5 && this.rng.chance(0.35) ? 'swat' : 'police');
        if (W.level >= 4 && (this.blockTimer -= dt) <= 0) {
            this.blockTimer = 26;
            this.roadblock();
        }
        this.heli.setActive(W.level >= 3);
        this.heli.update(dt);
        let nearest = 1e9;
        for (let i = this.units.length - 1; i >= 0; i--) {
            const u = this.units[i],
                d = Math.hypot(u.x - P.x, u.z - P.z);
            if (u.driver === 'player') {
                this.units.splice(i, 1);
                continue;
            }
            if ((W.level === 0 && d > 70) || d > 320 || (u.dead && d > 90)) {
                u.dispose();
                G.vehicles.splice(G.vehicles.indexOf(u), 1);
                this.units.splice(i, 1);
                continue;
            }
            if (!u.dead) nearest = Math.min(nearest, d);
            if (u.dead || u.driver !== 'police') continue;
            u.siren = W.level > 0;
            if (u.roadblock || W.level === 0) {
                u.ctl.throttle = 0;
                u.ctl.brake = 1;
                if (W.level === 0 && !u.roadblock) this.cruise(u);
                continue;
            }
            this.pursue(u, dt, d);
        }
        G.audio ? .siren(W.level > 0 ? nearest : 1e9);
        // busted: an officer next to the player on foot, or boxed in at a standstill
        if (W.level > 0 && !P.vehicle)
            for (const u of this.units)
                if (!u.dead && Math.hypot(u.x - P.x, u.z - P.z) < 5 && Math.abs(u.speed) < 2) this.bust += dt * 0.5;
        if (P.vehicle && W.level > 0 && Math.abs(P.vehicle.speed) < 1 && this.units.some((u) => !u.dead && Math.hypot(u.x - P.x, u.z - P.z) < 6.5)) this.bust += dt * 0.25;
        this.bust = Math.max(0, this.bust - dt * 0.15);
        if (this.bust >= 1 && !P.dead) {
            this.bust = 0;
            G.events.emit('playerDown', {
                cause: 'busted'
            });
        }
    }

    cruise(u) {
        u.ctl.throttle = 0.4;
        u.ctl.brake = 0;
    }

    pursue(u, dt, d) {
        const G = this.G,
            P = G.player,
            pv = P.vehicle;
        const lead = pv ? 0.7 : 0.2,
            tx = P.x + (pv ? pv.fx * pv.speed * lead : 0),
            tz = P.z + (pv ? pv.fz * pv.speed * lead : 0);
        let gx = tx,
            gz = tz;
        u.pathT -= dt;
        if (!G.collision.clearLine(u.x, u.z, tx, tz)) {
            if (u.pathT <= 0 || !u.path) {
                u.path = route(u.x, u.z, tx, tz);
                u.pathT = 1;
            }
            const nextPt = u.path.find((p, i) => i > 0 && Math.hypot(p[0] - u.x, p[1] - u.z) > 9);
            if (nextPt) {
                gx = nextPt[0];
                gz = nextPt[1];
            }
        }
        const want = Math.atan2(-(gx - u.x), -(gz - u.z)),
            err = wrapAngle(want - u.heading);
        const stopAt = pv ? 0 : 9;
        u.ctl.steer = clamp(err * 2.6, -1, 1);
        u.ctl.handbrake = Math.abs(err) > 1.2 && u.speed > 14;
        const fast = d > 30 ? 1 : 0.75;
        u.ctl.throttle = d > stopAt && Math.abs(err) < 2.2 ? fast : 0;
        u.ctl.brake = d < stopAt + 4 && !pv ? 1 : Math.abs(err) > 2.2 ? 0.6 : 0;
        if (u.reverse > 0) {
            u.reverse -= dt;
            u.ctl.throttle = 0;
            u.ctl.brake = 1;
            u.ctl.steer = -u.ctl.steer;
        } else if (u.ctl.throttle > 0 && Math.abs(u.speed) < 1) {
            u.stuck += dt;
            if (u.stuck > 1.5) {
                u.reverse = 1.2;
                u.stuck = 0;
            }
        } else u.stuck = 0;
        // officers bail out near a player on foot, and shoot from the car at 2★+
        if (!pv && d < 16 && Math.abs(u.speed) < 3 && !u.deployed) {
            u.deployed = true;
            for (const s of [-1, 1]) {
                const c = G.pedSystem.addArmed(u.x + -u.fz * s * 2.2, u.z + u.fx * s * 2.2, 'cop', { ...COP_LOOK,
                    skin: this.rng.pick(['#f1c7a5', '#b97850', '#8a5636', '#d9a07a'])
                });
                c.state = 'attack';
            }
        }
        u.fireCd -= dt;
        if (G.wanted.level >= 2 && d < 32 && u.fireCd <= 0 && G.collision.clearLine(u.x, u.z, P.x, P.z)) {
            u.fireCd = 1.1 - G.wanted.level * 0.12;
            G.combat.npcShoot({
                x: u.x,
                z: u.z,
                heading: want,
                rig: null
            }, P, 0.25 + G.wanted.level * 0.04, 5);
        }
    }

    clearAll() {
        const G = this.G;
        for (const u of this.units) {
            u.dispose();
            G.vehicles.splice(G.vehicles.indexOf(u), 1);
        }
        this.units = [];
        for (let i = G.peds.length - 1; i >= 0; i--)
            if (G.peds[i].role === 'cop') {
                G.peds[i].dispose();
                G.peds.splice(i, 1);
            }
        this.heli.setActive(false);
        this.heli.hide();
    }
}