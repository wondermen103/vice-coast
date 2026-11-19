// PoliceDispatch: 5-star PCPD response with pursuit interceptors, roadblocks, SWAT vans,
// Air-1 helicopter, busting logic, and live threat-feed roster.
import { Vehicle } from '../vehicles/Vehicle.ts';
import { Ped } from '../people/Pedestrians.ts';
import { HelicopterUnit } from './HelicopterUnit.ts';
import { BLOCK, GRID, nearestRoad, route } from '../world/CityLayout.ts';
import { clamp, pick, wrapAngle } from '../core/MathUtil.ts';
import { COP_LOOK, SWAT_LOOK } from '../people/PersonModel.ts';

const CALLSIGNS = [
  'Unit 11-Alpha',
  'Unit 14-Bravo',
  'Unit 22-Coastal',
  'Unit 31-Viper',
  'SWAT Hammer-1',
  'SWAT Hammer-2',
];

export interface PoliceRosterEntry {
  label: string;
  role: string;
  dist: number;
  status: string;
}

export class PoliceDispatch {
  public units: Vehicle[] = [];
  public officers: Ped[] = [];
  public heli: HelicopterUnit;
  private spawnT = 0;
  private bustT = 0;

  constructor(private G: any) {
    this.heli = new HelicopterUnit(G);
  }

  clear(): void {
    for (const u of this.units) {
      u.dispose();
      const i = this.G.vehicles.indexOf(u);
      if (i >= 0) this.G.vehicles.splice(i, 1);
    }
    for (const o of this.officers) {
      o.dispose();
      const i = this.G.peds.indexOf(o);
      if (i >= 0) this.G.peds.splice(i, 1);
    }
    this.units.length = 0;
    this.officers.length = 0;
    this.heli.setActive(false);
    this.bustT = 0;
  }

  bustProgress(amount: number): void {
    if (this.G.player.dead) return;
    this.bustT += amount;
    if (this.bustT > 2.4) {
      this.bustT = 0;
      this.G.events.emit('playerDown', { cause: 'busted' });
    }
  }

  roster(): PoliceRosterEntry[] {
    const P = this.G.player;
    const out: PoliceRosterEntry[] = [];
    for (const u of this.units) {
      if (u.dead) continue;
      out.push({
        label: u.callsign || 'VCPD Cruiser',
        role: u.roadblock ? 'ROADBLOCK' : u.model === 'swat' ? 'SWAT' : 'INTERCEPT',
        dist: Math.round(Math.hypot(u.x - P.x, u.z - P.z)),
        status: u.deployed ? 'ENGAGED' : u.roadblock ? 'HOLDING' : 'PURSUIT',
      });
    }
    if (this.heli.active) {
      out.push({
        label: 'Air-1 Chopper',
        role: 'AIR',
        dist: Math.round(Math.hypot(this.heli.x - P.x, this.heli.z - P.z)),
        status: this.G.wanted.level >= 4 ? 'FIRING' : 'SPOTLIGHT',
      });
    }
    return out.sort((a, b) => a.dist - b.dist).slice(0, 4);
  }

  private spawnUnit(level: number, asRoadblock = false): void {
    const G = this.G;
    const P = G.player;
    const fx = -Math.sin(P.heading);
    const fz = -Math.cos(P.heading);
    const ahead = asRoadblock ? 95 : 105;
    const ang = asRoadblock ? 0 : Math.random() * Math.PI * 2;
    const tx = clamp(
      P.x + (asRoadblock ? fx * ahead : Math.cos(ang) * ahead),
      0,
      GRID * BLOCK,
    );
    const tz = clamp(
      P.z + (asRoadblock ? fz * ahead : Math.sin(ang) * ahead),
      0,
      GRID * BLOCK,
    );
    const r = nearestRoad(tx, tz);
    if (Math.hypot(r.x - P.x, r.z - P.z) < 42) return;

    const swat = level >= 4 && Math.random() < 0.5;
    const model = swat ? 'swat' : 'police';
    const heading = asRoadblock
      ? r.axis === 'z'
        ? Math.PI / 2
        : 0
      : Math.atan2(r.x - P.x, r.z - P.z);
    const v = new Vehicle(G, model, '#ffffff', r.x, r.z, heading);
    v.role = 'police';
    v.driver = 'cop';
    v.siren = true;
    v.roadblock = asRoadblock;
    v.callsign = swat ? pick(CALLSIGNS.slice(4)) : pick(CALLSIGNS.slice(0, 4));
    G.vehicles.push(v);
    this.units.push(v);

    if (asRoadblock) {
      for (const side of [-2.8, 2.8]) {
        this.deployOfficer(v, side, level >= 4);
      }
      v.deployed = true;
    }
  }

  private deployOfficer(v: Vehicle, offset = 2.4, isSwat = false): void {
    const G = this.G;
    const o = new Ped(
      G,
      isSwat ? SWAT_LOOK : COP_LOOK,
      v.x + offset,
      v.z + offset * 0.4,
      'cop',
    );
    o.health = isSwat ? 110 : 65;
    o.heading = v.heading;
    G.peds.push(o);
    this.officers.push(o);
  }

  update(dt: number): void {
    const G = this.G;
    const level = G.wanted.level;
    const P = G.player;

    this.heli.update(dt, level);

    if (level <= 0) {
      if (this.units.length || this.officers.length) this.clear();
      return;
    }

    const desired = Math.min(6, level + 1);
    this.spawnT -= dt;
    if (this.spawnT <= 0 && this.units.filter((u) => !u.dead).length < desired) {
      const wantBlock = level >= 3 && Math.random() < 0.3;
      this.spawnUnit(level, wantBlock);
      this.spawnT = Math.max(2.2, 5.5 - level * 0.65);
    }

    let nearestCop = Infinity;

    for (let i = this.units.length - 1; i >= 0; i--) {
      const u = this.units[i];
      const d = Math.hypot(u.x - P.x, u.z - P.z);
      if (d > 240 && !u.dead) {
        u.dispose();
        const vi = G.vehicles.indexOf(u);
        if (vi >= 0) G.vehicles.splice(vi, 1);
        this.units.splice(i, 1);
        continue;
      }
      if (u.dead) continue;

      if (u.roadblock) {
        u.ctl.throttle = 0;
        u.ctl.brake = 1;
        u.ctl.steer = 0;
        continue;
      }

      if (d < 16 && !u.deployed && Math.abs(P.speed) < 9) {
        u.deployed = true;
        this.deployOfficer(u, 2.5, u.model === 'swat');
        if (level >= 3) this.deployOfficer(u, -2.5, u.model === 'swat');
      }

      if (u.deployed && d < 28) {
        u.ctl.throttle = 0;
        u.ctl.brake = 1;
        u.ctl.steer = 0;
        if (d < nearestCop) nearestCop = d;
        continue;
      }

      // Steer toward player (use BFS route if far, direct pursue if near)
      u.pathT -= dt;
      if (d > 58 && (!u.path || u.pathT <= 0)) {
        u.path = route(u.x, u.z, P.x, P.z);
        u.pathT = 2.6;
      }
      let tx = P.x;
      let tz = P.z;
      if (u.path && u.path.length > 1 && d > 36) {
        while (
          u.path.length > 1 &&
          Math.hypot(u.path[0][0] - u.x, u.path[0][1] - u.z) < 16
        ) {
          u.path.shift();
        }
        tx = u.path[0][0];
        tz = u.path[0][1];
      }

      const want = Math.atan2(-(tx - u.x), -(tz - u.z));
      const diff = wrapAngle(want - u.heading);
      u.ctl.steer = clamp(diff * 2.1, -1, 1);
      const targetSpd = Math.min(u.spec.top * (0.72 + level * 0.06), d > 18 ? 46 : 18);
      u.ctl.throttle = u.speed < targetSpd ? 1 : 0;
      u.ctl.brake = u.speed > targetSpd + 6 ? 0.8 : 0;

      if (Math.abs(u.speed) < 0.7) {
        u.stuck += dt;
        if (u.stuck > 1.4) {
          u.reverse = 0.9;
          u.stuck = 0;
        }
      } else {
        u.stuck = 0;
      }
      if (u.reverse > 0) {
        u.reverse -= dt;
        u.ctl.throttle = 0;
        u.ctl.brake = 1;
        u.ctl.steer = -u.ctl.steer;
      }
      if (d < nearestCop) nearestCop = d;
    }

    // Prune far/dead officers
    for (let i = this.officers.length - 1; i >= 0; i--) {
      const o = this.officers[i];
      const d = Math.hypot(o.x - P.x, o.z - P.z);
      if (d < nearestCop && !o.dead) nearestCop = d;
      if (d > 190 || (o.dead && d > 90)) {
        o.dispose();
        const pi = G.peds.indexOf(o);
        if (pi >= 0) G.peds.splice(pi, 1);
        this.officers.splice(i, 1);
      }
    }

    // Busting check when player is slow & cornered at close range
    const trapped =
      !P.dead &&
      nearestCop < (P.vehicle ? 4.4 : 3.2) &&
      Math.abs(P.speed) < 2.2;
    if (trapped) {
      this.bustT += dt;
      if (this.bustT > 2.4) {
        this.bustT = 0;
        G.events.emit('playerDown', { cause: 'busted' });
      }
    } else {
      this.bustT = Math.max(0, this.bustT - dt * 2);
    }
  }
}
