// Vehicle: arcade driving physics with nitrous boost, stunt ramp jumps, wet-road grip modulation,
// paint finishes, neon underglow, collisions, smoke, and explosions.
import * as THREE from 'three';
import {
  applyPaintFinish,
  buildCar,
  CAR_SPECS,
  type CarSpec,
  type PaintFinish,
} from './CarModels.ts';
import { clamp, damp, wrapAngle } from '../core/MathUtil.ts';
import { sampleStuntRamp } from '../world/CityLayout.ts';

let NEXT_ID = 1;

export class Vehicle {
  public id = NEXT_ID++;
  public spec: CarSpec;
  public group: THREE.Group;
  public wheels: THREE.Object3D[];
  public glows: THREE.Sprite[];
  public bar: {
    red: THREE.Mesh;
    blue: THREE.Mesh;
    rg: THREE.Sprite;
    bg: THREE.Sprite;
  } | null;
  public paintMat: THREE.MeshPhysicalMaterial;
  public underglow: THREE.Mesh;
  public underglowMat: THREE.MeshBasicMaterial;
  public finish: PaintFinish = 'gloss';
  public underglowIdx = 0;

  public y = 0;
  public vy = 0;
  public airborne = false;
  public speed = 0;
  public lat = 0;
  public steer = 0;
  public yawRate = 0;
  private bodyRoll = 0;
  private bodyPitch = 0;
  public health: number;
  public maxHealth: number;
  public driver: string | null = null;
  public role = 'parked';
  public siren = false;
  public dead = false;
  public burn = 0;
  public upgrade = 0;
  public armor = 0;
  public nitroTier = 0;
  public boosting = false;
  public crashedHard = false;
  public flash = Math.random() * 10;
  public panic = 0;
  public lane: any = null;
  public plan: any = null;
  public cruise = 11;
  public stuck = 0;
  public reverse = 0;
  public path: [number, number][] | null = null;
  public pathT = 0;
  public fireCd = 1;
  public deployed = false;
  public roadblock = false;
  public callsign = '';
  public radius: number;

  public ctl = {
    throttle: 0,
    brake: 0,
    steer: 0,
    handbrake: false,
    nitro: false,
  };

  constructor(
    private G: any,
    public model: string,
    public paint: string,
    public x: number,
    public z: number,
    public heading: number,
  ) {
    this.spec = CAR_SPECS[model];
    const built = buildCar(model, paint, !!G.isSoftwareGl);
    this.group = built.group;
    this.wheels = built.wheels;
    this.glows = built.glows;
    this.bar = built.bar;
    this.paintMat = built.paintMat;
    this.underglow = built.underglow;
    this.underglowMat = built.underglowMat;
    if (this.spec.kind === 'hyper') {
      this.underglowIdx = 1;
    }
    this.health = 100 * this.spec.mass;
    this.maxHealth = this.health;
    this.radius = this.spec.wid * 0.55;
    G.scene.add(this.group);
    this.sync(0);
  }

  get fx(): number {
    return -Math.sin(this.heading);
  }
  get fz(): number {
    return -Math.cos(this.heading);
  }

  setFinish(finish: PaintFinish): void {
    this.finish = finish;
    applyPaintFinish(this.paintMat, finish);
  }

  setUnderglow(color: string | null, idx: number): void {
    this.underglowIdx = idx;
    if (!color) {
      this.underglow.visible = false;
    } else {
      this.underglowMat.color.set(color);
      this.underglow.visible = true;
    }
  }

  update(dt: number, nitroMult = 1): void {
    const s = this.spec;
    const c = this.ctl;
    this.crashedHard = false;
    const weatherGrip = this.G.sky?.spec?.().gripScale ?? 1;

    if (this.dead) {
      this.speed = damp(this.speed, 0, 2, dt);
      this.lat = damp(this.lat, 0, 3, dt);
    } else {
      const top = s.top * (1 + this.upgrade * 0.12) * nitroMult;
      const acc = s.acc * (1 + this.upgrade * 0.15) * (nitroMult > 1 ? 1.55 : 1);
      if (c.throttle > 0 || nitroMult > 1) {
        const push = nitroMult > 1 ? Math.max(c.throttle, 1) : c.throttle;
        this.speed += push * acc * Math.max(0.18, 1 - this.speed / top) * dt;
      }
      if (c.brake > 0) {
        this.speed -=
          c.brake * (this.speed > 0.5 ? 26 : 7) * dt * (this.speed < -12 ? 0 : 1);
      }
      if (!c.throttle && !c.brake && nitroMult <= 1) {
        this.speed = damp(this.speed, 0, 0.35, dt);
      }
      if (c.handbrake && !this.airborne) {
        this.speed = damp(this.speed, 0, 1.05, dt);
      }
      this.speed = clamp(this.speed, -14, top);
    }

    const sp = Math.abs(this.speed);
    this.steer = damp(this.steer, c.steer, 10, dt);
    const airSteer = this.airborne ? 0.25 : 1;
    const steerGain = (2.05 / (1 + sp * 0.042)) * clamp(sp / 4.2, 0, 1) * airSteer;
    const yaw = this.steer * steerGain * Math.sign(this.speed || 1);
    this.yawRate = yaw;
    this.heading = wrapAngle(this.heading + yaw * dt * (c.handbrake ? 1.48 : 1));

    const slipIn = c.handbrake ? 0.56 : 0.12 / weatherGrip;
    this.lat += -yaw * this.speed * slipIn * dt * 2;
    this.lat = damp(
      this.lat,
      0,
      (c.handbrake ? 1.2 : s.grip * weatherGrip) * (this.airborne ? 0.2 : 1),
      dt,
    );

    // Smooth suspension body roll & acceleration/braking pitch for realistic automotive weight
    const targetRoll = clamp(-this.yawRate * sp * 0.0045 - this.lat * 0.008, -0.09, 0.09);
    const targetPitch = this.airborne
      ? clamp(this.vy * 0.028, -0.25, 0.28)
      : clamp((c.throttle * (nitroMult > 1 ? 0.055 : 0.025) - c.brake * 0.042) * clamp(sp / 12 + 0.3, 0, 1), -0.055, 0.065);
    this.bodyRoll = damp(this.bodyRoll, targetRoll, 9, dt);
    this.bodyPitch = damp(this.bodyPitch, targetPitch, 8, dt);

    const rx = -this.fz;
    const rz = this.fx;
    let nx = this.x + (this.fx * this.speed + rx * this.lat) * dt;
    let nz = this.z + (this.fz * this.speed + rz * this.lat) * dt;

    // Two collision circles along the body
    let hitN: { nx: number; nz: number } | null = null;
    for (const o of [-0.3, 0.3]) {
      const cx = nx + this.fx * s.len * o;
      const cz = nz + this.fz * s.len * o;
      const r = this.G.collision.resolve(cx, cz, this.radius);
      if (r.hit) {
        nx += r.x - cx;
        nz += r.z - cz;
        hitN = r;
      }
    }
    if (hitN) {
      const into = -(this.fx * hitN.nx + this.fz * hitN.nz) * this.speed;
      if (into > 3) {
        this.damage(into * 1.3);
        this.G.fx?.sparks(nx + this.fx * 2, this.y + 0.6, nz + this.fz * 2, 10);
        this.G.audio?.crash(into / 30);
        if (into > 12) this.crashedHard = true;
      }
      this.speed *= into > 0 ? 0.45 : 0.9;
      this.lat *= 0.5;
    }

    this.x = nx;
    this.z = nz;

    // Vertical physics & Stunt Ramps
    const ramp = sampleStuntRamp(this.x, this.z);
    if (ramp && this.y <= ramp.height + 0.45) {
      const rampFx = -Math.sin(ramp.ramp.heading);
      const rampFz = -Math.cos(ramp.ramp.heading);
      const align = this.fx * rampFx + this.fz * rampFz;
      this.y = ramp.height;
      const slopeRatio = ramp.ramp.height / ramp.ramp.length;
      if (this.speed > 10 && align > 0.45) {
        this.vy = Math.max(this.vy, this.speed * slopeRatio * 1.55);
      } else {
        this.vy = 0;
      }
      this.airborne = false;
    } else if (this.y > 0.02 || this.vy > 0.1) {
      this.vy -= 21 * dt;
      this.y += this.vy * dt;
      if (this.y <= 0) {
        const impact = Math.abs(this.vy);
        this.y = 0;
        this.vy = 0;
        this.airborne = false;
        if (impact > 7) {
          this.G.fx?.sparks(this.x, 0.2, this.z, 10);
          this.G.audio?.thud();
          if (this === this.G.player.vehicle) {
            this.G.cam.addShake(Math.min(0.45, impact * 0.03));
          }
        }
      } else {
        this.airborne = this.y > 0.35;
      }
    } else {
      this.y = 0;
      this.vy = 0;
      this.airborne = false;
    }

    // Smoke / Fire / Drift tyre smoke / Nitrous flames
    if (this.health < this.maxHealth * 0.35 && !this.dead && Math.random() < dt * 8) {
      this.G.fx?.smoke(
        this.x + this.fx * 1.8,
        this.y + 1.1,
        this.z + this.fz * 1.8,
        this.health < this.maxHealth * 0.15 ? 1 : 0,
      );
    }
    if (this.dead && this.burn > 0) {
      this.burn -= dt;
      if (Math.random() < dt * 20) this.G.fx?.fire(this.x, this.y + 1.2, this.z);
    }
    if (
      !this.airborne &&
      sp > 8 &&
      (c.handbrake || Math.abs(this.lat) > 3.2) &&
      Math.random() < dt * 30
    ) {
      this.G.fx?.tyreSmoke(this.x - this.fx * 1.6, this.z - this.fz * 1.6);
    }
    if (this.boosting && !this.dead) {
      for (const side of [-0.45, 0.45]) {
        const ex = this.x - this.fx * (s.len * 0.52) + rx * side;
        const ez = this.z - this.fz * (s.len * 0.52) + rz * side;
        this.G.fx?.nitroFlame(ex, this.y + 0.42, ez, -this.fx * 6, -this.fz * 6);
      }
    }

    this.sync(dt);
  }

  sync(dt: number): void {
    const g = this.group;
    g.position.set(this.x, this.y, this.z);
    g.rotation.y = this.heading;
    g.rotation.z = this.bodyRoll;
    g.rotation.x = this.bodyPitch;

    for (const w of this.wheels) {
      w.rotation.x -= (this.speed * dt) / 0.37;
      if (w.userData.front) w.rotation.y = this.steer * 0.45;
      w.rotation.order = 'YXZ';
    }

    const night = this.G.sky
      ? this.G.sky.night + (this.G.sky.sunDir.y < 0.2 ? 0.6 : 0) + (this.G.sky.weather === 'storm' ? 0.5 : 0)
      : 0;
    for (let i = 0; i < this.glows.length; i++) {
      const head = i % 2 === 0;
      this.glows[i].visible =
        !this.dead && (head ? night > 0.3 : night > 0.3 || this.ctl.brake > 0);
      if (!head) this.glows[i].scale.setScalar(this.ctl.brake > 0 ? 1.7 : 1.0);
    }

    if (this.bar) {
      this.flash += dt * 9;
      const on = this.siren && !this.dead;
      const a = Math.sin(this.flash) > 0;
      const b = Math.sin(this.flash * 1.37 + 1) > 0;
      this.bar.rg.visible = on && a;
      this.bar.bg.visible = on && !a;
      (this.bar.red.material as THREE.MeshBasicMaterial).color.setRGB(
        on && a ? 4 : 0.4,
        0.05,
        0.08,
      );
      (this.bar.blue.material as THREE.MeshBasicMaterial).color.setRGB(
        0.05,
        0.2,
        on && !a ? 5 : 0.5,
      );
      this.bar.rg.scale.setScalar(b && on ? 5 : 3.6);
      this.bar.bg.scale.setScalar(b && on ? 5 : 3.6);
    }
  }

  damage(n: number): void {
    if (this.dead) return;
    this.health -= n * (1 - this.armor * 0.2);
    if (this.health <= 0) this.explode();
  }

  explode(): void {
    this.dead = true;
    this.health = 0;
    this.burn = 14;
    this.boosting = false;
    this.underglow.visible = false;
    this.paintMat.color.set('#2a2522');
    this.paintMat.clearcoat = 0;
    this.paintMat.metalness = 0;
    this.G.fx?.explosion(this.x, this.y + 1, this.z);
    this.G.audio?.explosion();
    this.G.hitstop = Math.max(this.G.hitstop || 0, 0.05);
    this.G.events.emit('explosion', { x: this.x, z: this.z, vehicle: this });
  }

  dispose(): void {
    this.G.scene.remove(this.group);
  }
}
