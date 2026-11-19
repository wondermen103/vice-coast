// TrafficAI: lane-following civilian traffic with turns and braking, parked cars, car-to-car crashes.
import {
    Vehicle
} from '../vehicles/Vehicle.js';
import {
    PAINTS,
    TRAFFIC_MODELS
} from '../vehicles/CarModels.js';
import {
    Rng,
    clamp,
    wrapAngle
} from '../core/MathUtil.js';
import {
    BLOCK,
    GRID,
    LANE,
    ROAD,
    SIZE
} from '../world/CityLayout.js';

export function laneHeading(lane) {
    return lane.axis === 'z' ? (lane.dir < 0 ? 0 : Math.PI) : (lane.dir > 0 ? -Math.PI / 2 : Math.PI / 2);
}
export function lanePoint(lane, along) {
    return lane.axis === 'z' ? [lane.k * BLOCK - lane.dir * LANE, along] : [along, lane.k * BLOCK + lane.dir * LANE];
}

export class TrafficSystem {
    constructor(G) {
        this.G = G;
        G.vehicles = [];
        this.rng = new Rng(77);
        this.target = 24;
    }

    init() {
        const r = this.rng;
        for (let i = 0; i < 46; i++) { // parked cars along curbs, free to take
            const axis = r.chance(0.5) ? 'z' : 'x',
                k = r.int(0, GRID),
                seg = r.int(0, GRID - 1),
                side = r.chance(0.5) ? 1 : -1;
            const along = seg * BLOCK + r.range(16, BLOCK - 16),
                off = k * BLOCK + side * (ROAD / 2 - 1.4);
            const [x, z] = axis === 'z' ? [off, along] : [along, off];
            const h = axis === 'z' ? (side > 0 ? Math.PI : 0) : (side > 0 ? -Math.PI / 2 : Math.PI / 2);
            this.add(r.pick(TRAFFIC_MODELS), r.pick(PAINTS), x, z, h, 'parked');
        }
    }

    add(model, paint, x, z, h, role) {
        const v = new Vehicle(this.G, model, paint, x, z, h);
        v.role = role;
        this.G.vehicles.push(v);
        return v;
    }

    spawnMover(px, pz, minD = 70, maxD = 210) {
        const r = this.rng;
        for (let tries = 0; tries < 20; tries++) {
            const lane = {
                axis: r.chance(0.5) ? 'z' : 'x',
                k: r.int(0, GRID),
                dir: r.chance(0.5) ? 1 : -1
            };
            const along = r.range(0, SIZE),
                [x, z] = lanePoint(lane, along),
                d = Math.hypot(x - px, z - pz);
            if (d < minD || d > maxD) continue;
            if (Math.abs(((along % BLOCK) + BLOCK) % BLOCK - 0) < 12 || Math.abs((along % BLOCK) - BLOCK) < 12) continue;
            if (this.G.vehicles.some((v) => Math.hypot(v.x - x, v.z - z) < 12)) continue;
            const v = this.add(r.pick(TRAFFIC_MODELS), r.pick(PAINTS), x, z, laneHeading(lane), 'traffic');
            v.lane = lane;
            v.driver = 'ai';
            v.speed = 8;
            v.cruise = r.range(10, 14);
            return v;
        }
        return null;
    }

    drive(v, dt) {
        const lane = v.lane,
            a = lane.axis === 'z' ? v.z : v.x;
        const ni = lane.dir > 0 ? Math.ceil((a + 1) / BLOCK) : Math.floor((a - 1) / BLOCK),
            ic = ni * BLOCK,
            dist = (ic - a) * lane.dir;
        if (!v.plan || v.plan.ic !== ic || v.plan.axis !== lane.axis) {
            const opts = [],
                other = lane.axis === 'z' ? 'x' : 'z',
                okNext = ni >= 0 && ni <= GRID;
            const cross = lane.axis === 'z' ? Math.round(v.x / BLOCK) : Math.round(v.z / BLOCK);
            if (okNext && ni + lane.dir >= 0 && ni + lane.dir <= GRID) opts.push(null, null);
            for (const d of [-1, 1])
                if (okNext && cross + d >= 0 && cross + d <= GRID) opts.push({
                    axis: other,
                    k: ni,
                    dir: d
                });
            if (!opts.length) opts.push({
                axis: lane.axis,
                k: lane.k,
                dir: -lane.dir
            });
            v.plan = {
                ic,
                axis: lane.axis,
                next: this.rng.pick(opts)
            };
        }
        const nx = v.plan.next;
        if (nx) {
            const right = nx.axis !== lane.axis && (lane.axis === 'z' ? nx.dir === -lane.dir : nx.dir === lane.dir); // right turns switch earlier
            if (dist < (right ? LANE + 1 : -LANE + 1)) {
                v.lane = nx;
                v.plan = null;
            }
        }
        const L = v.lane,
            pa = (L.axis === 'z' ? v.z : v.x) + L.dir * 9;
        const [tx, tz] = lanePoint(L, pa);
        const want = Math.atan2(-(tx - v.x), -(tz - v.z));
        const err = wrapAngle(want - v.heading);
        let target = Math.abs(err) > 0.3 ? 6 : v.cruise * (v.panic > 0 ? 1.6 : 1);
        if (v.panic > 0) v.panic -= dt;
        // brake for anything in front
        const G = this.G,
            fx = v.fx,
            fz = v.fz;
        const blockers = [...G.vehicles, G.player.vehicle ? null : G.player, ...G.peds.filter((p) => !p.dead && Math.hypot(p.x - v.x, p.z - v.z) < 14)];
        for (const o of blockers) {
            if (!o || o === v) continue;
            const dx = o.x - v.x,
                dz = o.z - v.z,
                fwd = dx * fx + dz * fz;
            if (fwd < 0 || fwd > 15) continue;
            if (Math.abs(dx * -fz + dz * fx) < 2.4) target = Math.min(target, Math.max(0, (fwd - 6) * 1.2));
        }
        v.ctl.steer = clamp(err * 2.4, -1, 1);
        v.ctl.throttle = v.speed < target ? 0.8 : 0;
        v.ctl.brake = v.speed > target + 1.5 ? 0.9 : 0;
        v.ctl.handbrake = false;
    }

    update(dt) {
        const G = this.G,
            P = G.player,
            px = P.x,
            pz = P.z;
        let movers = 0;
        for (let i = G.vehicles.length - 1; i >= 0; i--) {
            const v = G.vehicles[i],
                d = Math.hypot(v.x - px, v.z - pz);
            if (v.role === 'traffic') {
                movers++;
                if (d > 280 && v !== P.vehicle) {
                    v.dispose();
                    G.vehicles.splice(i, 1);
                    continue;
                }
                if (v.driver === 'ai' && !v.dead) this.drive(v, dt);
                else if (!v.driver) {
                    v.ctl.throttle = 0;
                    v.ctl.brake = 0.4;
                    v.ctl.steer = 0;
                }
            }
            if (d < 320 || v === P.vehicle) v.update(dt);
        }
        if (movers < this.target) this.spawnMover(px, pz);
        this.collide(dt);
    }

    // Car-to-car impacts: push apart, trade momentum, deal damage, report the player's crashes.
    collide() {
        const vs = this.G.vehicles;
        for (let i = 0; i < vs.length; i++)
            for (let j = i + 1; j < vs.length; j++) {
                const a = vs[i],
                    b = vs[j],
                    dx = b.x - a.x,
                    dz = b.z - a.z,
                    d = Math.hypot(dx, dz),
                    min = (a.spec.len + b.spec.len) * 0.36;
                if (d > min || d < 0.01) continue;
                const nx = dx / d,
                    nz = dz / d,
                    push = (min - d) / 2;
                a.x -= nx * push;
                a.z -= nz * push;
                b.x += nx * push;
                b.z += nz * push;
                const va = (a.fx * nx + a.fz * nz) * a.speed,
                    vb = (b.fx * nx + b.fz * nz) * b.speed,
                    rel = va - vb;
                if (rel > 0) {
                    const ma = a.spec.mass,
                        mb = b.spec.mass;
                    a.speed *= 1 - clamp(rel / 30, 0.1, 0.7) * mb / (ma + mb) * 1.4;
                    b.speed += rel * ma / (ma + mb) * 0.6;
                    if (rel > 6) {
                        a.damage(rel * 1.1 * mb);
                        b.damage(rel * 1.1 * ma);
                        this.G.fx ? .sparks((a.x + b.x) / 2, 0.7, (a.z + b.z) / 2, 14);
                        this.G.audio ? .crash(rel / 25);
                        this.G.events.emit('carCrash', {
                            a,
                            b,
                            rel
                        });
                    }
                }
            }
    }
}