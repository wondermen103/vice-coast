// TrafficAI: lane-following traffic, parked fleet (including Solaris V12 showcase), Armored Cash Van patrol,
// car-to-car impacts, and Near-Miss stunt detection.
import { Vehicle } from '../vehicles/Vehicle.ts';
import { PAINTS, TRAFFIC_MODELS } from '../vehicles/CarModels.ts';
import { Rng, clamp, wrapAngle } from '../core/MathUtil.ts';
import { BLOCK, GRID, LANE, ROAD, SIZE } from '../world/CityLayout.ts';

export interface LaneDef {
  axis: 'x' | 'z';
  k: number;
  dir: number;
}

export function laneHeading(lane: LaneDef): number {
  return lane.axis === 'z'
    ? lane.dir < 0
      ? 0
      : Math.PI
    : lane.dir > 0
      ? -Math.PI / 2
      : Math.PI / 2;
}

export function lanePoint(lane: LaneDef, along: number): [number, number] {
  return lane.axis === 'z'
    ? [lane.k * BLOCK - lane.dir * LANE, along]
    : [along, lane.k * BLOCK + lane.dir * LANE];
}

export class TrafficSystem {
  private rng = new Rng(77);
  public target = 22;
  public cashVan: Vehicle | null = null;
  private cashVanRespawn = 20;

  constructor(private G: any) {
    G.vehicles = [];
  }

  init(): void {
    const r = this.rng;
    // Parked Solaris V12 Hypercar near Downtown Cristal & Aureo GT along Malecón for discovery!
    const heroCar = this.add('solaris', '#ff8c42', 216 + 6, 224, 0, 'parked');
    heroCar.setFinish('pearl');
    heroCar.setUnderglow('#2df2e6', 1);

    const beachCabrio = this.add('palma', '#3ec1d3', 7, 380, Math.PI, 'parked');
    beachCabrio.setFinish('gloss');

    for (let i = 0; i < 42; i++) {
      const axis = r.chance(0.5) ? 'z' : 'x';
      const k = r.int(0, GRID);
      const seg = r.int(0, GRID - 1);
      const side = r.chance(0.5) ? 1 : -1;
      const along = seg * BLOCK + r.range(16, BLOCK - 16);
      const off = k * BLOCK + side * (ROAD / 2 - 1.4);
      const [x, z] = axis === 'z' ? [off, along] : [along, off];
      const h =
        axis === 'z'
          ? side > 0
            ? Math.PI
            : 0
          : side > 0
            ? -Math.PI / 2
            : Math.PI / 2;
      this.add(r.pick(TRAFFIC_MODELS), r.pick(PAINTS), x, z, h, 'parked');
    }
  }

  add(
    model: string,
    paint: string,
    x: number,
    z: number,
    h: number,
    role: string,
  ): Vehicle {
    const v = new Vehicle(this.G, model, paint, x, z, h);
    v.role = role;
    this.G.vehicles.push(v);
    return v;
  }

  spawnMover(px: number, pz: number, minD = 70, maxD = 210): Vehicle | null {
    const r = this.rng;
    for (let tries = 0; tries < 20; tries++) {
      const lane: LaneDef = {
        axis: r.chance(0.5) ? 'z' : 'x',
        k: r.int(0, GRID),
        dir: r.chance(0.5) ? 1 : -1,
      };
      const along = r.range(0, SIZE);
      const [x, z] = lanePoint(lane, along);
      const d = Math.hypot(x - px, z - pz);
      if (d < minD || d > maxD) continue;
      if (
        Math.abs((((along % BLOCK) + BLOCK) % BLOCK) - 0) < 12 ||
        Math.abs((along % BLOCK) - BLOCK) < 12
      ) {
        continue;
      }
      if (this.G.vehicles.some((v: Vehicle) => Math.hypot(v.x - x, v.z - z) < 12)) continue;
      const v = this.add(
        r.pick(TRAFFIC_MODELS),
        r.pick(PAINTS),
        x,
        z,
        laneHeading(lane),
        'traffic',
      );
      v.lane = lane;
      v.driver = 'ai';
      v.speed = 8;
      v.cruise = r.range(10, 14);
      return v;
    }
    return null;
  }

  private spawnCashVan(px: number, pz: number): void {
    const lane: LaneDef = {
      axis: this.rng.chance(0.5) ? 'z' : 'x',
      k: this.rng.int(1, GRID - 1),
      dir: this.rng.chance(0.5) ? 1 : -1,
    };
    const along = this.rng.range(40, SIZE - 40);
    const [x, z] = lanePoint(lane, along);
    if (Math.hypot(x - px, z - pz) < 60) return;
    const v = this.add('cashvan', '#1e2b36', x, z, laneHeading(lane), 'cashvan');
    v.lane = lane;
    v.driver = 'ai';
    v.speed = 9;
    v.cruise = 11.5;
    this.cashVan = v;
  }

  private drive(v: Vehicle, dt: number): void {
    const lane = v.lane as LaneDef;
    const a = lane.axis === 'z' ? v.z : v.x;
    const ni = lane.dir > 0 ? Math.ceil((a + 1) / BLOCK) : Math.floor((a - 1) / BLOCK);
    const ic = ni * BLOCK;
    const dist = (ic - a) * lane.dir;

    if (!v.plan || v.plan.ic !== ic || v.plan.axis !== lane.axis) {
      const opts: Array<LaneDef | null> = [];
      const other: 'x' | 'z' = lane.axis === 'z' ? 'x' : 'z';
      const okNext = ni >= 0 && ni <= GRID;
      const cross = lane.axis === 'z' ? Math.round(v.x / BLOCK) : Math.round(v.z / BLOCK);
      if (okNext && ni + lane.dir >= 0 && ni + lane.dir <= GRID) opts.push(null, null);
      for (const d of [-1, 1]) {
        if (okNext && cross + d >= 0 && cross + d <= GRID) {
          opts.push({ axis: other, k: ni, dir: d });
        }
      }
      if (!opts.length) opts.push({ axis: lane.axis, k: lane.k, dir: -lane.dir });
      v.plan = { ic, axis: lane.axis, next: this.rng.pick(opts) };
    }

    const nx = v.plan.next as LaneDef | null;
    if (nx) {
      const right =
        nx.axis !== lane.axis &&
        (lane.axis === 'z' ? nx.dir === -lane.dir : nx.dir === lane.dir);
      if (dist < (right ? LANE + 1 : -LANE + 1)) {
        v.lane = nx;
        v.plan = null;
      }
    }

    const L = v.lane as LaneDef;
    const pa = (L.axis === 'z' ? v.z : v.x) + L.dir * 9;
    const [tx, tz] = lanePoint(L, pa);
    const want = Math.atan2(-(tx - v.x), -(tz - v.z));
    const err = wrapAngle(want - v.heading);
    let target = Math.abs(err) > 0.3 ? 6 : v.cruise * (v.panic > 0 ? 1.6 : 1);
    if (v.panic > 0) v.panic -= dt;

    const G = this.G;
    const fx = v.fx;
    const fz = v.fz;
    for (const o of G.vehicles as Vehicle[]) {
      if (o === v) continue;
      const dx = o.x - v.x;
      const dz = o.z - v.z;
      const fwd = dx * fx + dz * fz;
      if (fwd < 0 || fwd > 15) continue;
      if (Math.abs(dx * -fz + dz * fx) < 2.4) {
        target = Math.min(target, Math.max(0, (fwd - 6) * 1.2));
      }
    }

    v.ctl.steer = clamp(err * 2.4, -1, 1);
    v.ctl.throttle = v.speed < target ? 0.8 : 0;
    v.ctl.brake = v.speed > target + 1.5 ? 0.9 : 0;
    v.ctl.handbrake = false;
  }

  update(dt: number): void {
    const G = this.G;
    const P = G.player;
    const px = P.x;
    const pz = P.z;
    let movers = 0;

    // Armored Cash Van world event management
    if (this.cashVan && (this.cashVan.dead || this.cashVan.driver === 'player')) {
      if (this.cashVan.dead && this.cashVan.role === 'cashvan') {
        G.economy.dropCash(this.cashVan.x, this.cashVan.z, 1200);
        this.cashVan.role = 'wrecked';
      }
      this.cashVan = null;
      this.cashVanRespawn = 45;
    } else if (!this.cashVan && G.mode === 'play') {
      this.cashVanRespawn -= dt;
      if (this.cashVanRespawn <= 0) {
        this.spawnCashVan(px, pz);
      }
    }

    for (let i = G.vehicles.length - 1; i >= 0; i--) {
      const v = G.vehicles[i] as Vehicle;
      const d = Math.hypot(v.x - px, v.z - pz);
      if (v.role === 'traffic' || v.role === 'cashvan') {
        if (v.role === 'traffic') movers++;
        if (v.role === 'traffic' && d > 280 && v !== P.vehicle) {
          v.dispose();
          G.vehicles.splice(i, 1);
          continue;
        }
        if (v.driver === 'ai' && !v.dead && v.lane) this.drive(v, dt);
        else if (!v.driver) {
          v.ctl.throttle = 0;
          v.ctl.brake = 0.4;
          v.ctl.steer = 0;
        }
      }

      if (d < 320 || v === P.vehicle) {
        const nitroMult = v === P.vehicle ? P.lastNitroMult : 1;
        v.update(dt, nitroMult);
      }

      // High-speed Near-Miss detection for player vehicle
      if (
        P.vehicle &&
        v !== P.vehicle &&
        !v.dead &&
        Math.abs(P.vehicle.speed) > 19 &&
        d > 3.1 &&
        d < 4.9
      ) {
        P.triggerNearMiss();
      }
    }
    if (movers < this.target) this.spawnMover(px, pz);
    this.collide();
  }

  private collide(): void {
    const vs = this.G.vehicles as Vehicle[];
    for (let i = 0; i < vs.length; i++) {
      for (let j = i + 1; j < vs.length; j++) {
        const a = vs[i];
        const b = vs[j];
        if (Math.abs(a.y - b.y) > 1.8) continue;
        const dx = b.x - a.x;
        const dz = b.z - a.z;
        const d = Math.hypot(dx, dz);
        const min = (a.spec.len + b.spec.len) * 0.36;
        if (d > min || d < 0.01) continue;
        const nx = dx / d;
        const nz = dz / d;
        const push = (min - d) / 2;
        a.x -= nx * push;
        a.z -= nz * push;
        b.x += nx * push;
        b.z += nz * push;
        const va = (a.fx * nx + a.fz * nz) * a.speed;
        const vb = (b.fx * nx + b.fz * nz) * b.speed;
        const rel = va - vb;
        if (rel > 0) {
          const ma = a.spec.mass;
          const mb = b.spec.mass;
          a.speed *= 1 - (clamp(rel / 30, 0.1, 0.7) * mb) / (ma + mb) * 1.4;
          b.speed += (rel * ma) / (ma + mb) * 0.6;
          if (rel > 6) {
            a.damage(rel * 1.1 * mb);
            b.damage(rel * 1.1 * ma);
            if (rel > 14) {
              a.crashedHard = true;
              b.crashedHard = true;
            }
            this.G.fx?.sparks((a.x + b.x) / 2, 0.7, (a.z + b.z) / 2, 14);
            this.G.audio?.crash(rel / 25);
            this.G.events.emit('carCrash', { a, b, rel });
          }
        }
      }
    }
  }
}
