// PlayerController: Dual-protagonist system (Jason Vance & Lucia Reyes) with ultra-smooth damped
// on-foot locomotion, GTA VI Focus Mode (Q time-dilation), StuntSystem (Nitrous, Drifts, Jumps),
// and seamless vehicle/partner integration.
import { Ped } from '../people/Pedestrians.ts';
import { clamp, damp, formatMoney, wrapAngle } from '../core/MathUtil.ts';
import {
  animatePerson,
  buildPerson,
  JASON_LOOK,
  LUCIA_LOOK,
  type PersonLook,
} from '../people/PersonModel.ts';
import {
  createStuntState,
  registerNearMiss,
  stepStuntState,
  type StuntState,
} from '../core/StuntSystem.ts';
import type { Vehicle } from '../vehicles/Vehicle.ts';
import { WEATHER_SPECS } from '../core/WeatherRules.ts';

export type ProtagonistId = 'jason' | 'lucia';

export const PROTAGONIST_INFO: Record<
  ProtagonistId,
  { name: string; firstName: string; role: string; perk: string; accent: string; look: PersonLook }
> = {
  jason: {
    name: 'Jason Vance',
    firstName: 'JASON',
    role: 'Getaway Driver',
    perk: 'Apex Nitrous & Drift Control',
    accent: '#00f0d8',
    look: JASON_LOOK,
  },
  lucia: {
    name: 'Lucia Reyes',
    firstName: 'LUCIA',
    role: 'Heist Tactician',
    perk: 'Extended Dead-Eye Focus',
    accent: '#ff2e93',
    look: LUCIA_LOOK,
  },
};

export const NICO_LOOK: PersonLook = JASON_LOOK;

export class PlayerController {
  public protagonist: ProtagonistId = 'jason';
  public ped: Ped;
  public health = 100;
  public armor = 25;
  public focus = 100;
  public focusActive = false;
  public vehicle: Vehicle | null = null;
  public dead = false;
  public stamina = 1;
  public x = 0;
  public z = 0;
  public heading = 0;
  public speed = 0;
  public velX = 0;
  public velZ = 0;
  public stunt: StuntState = createStuntState();
  public lastNitroMult = 1;

  constructor(private G: any) {
    this.ped = new Ped(G, { ...JASON_LOOK }, 0, 0, 'player');
  }

  setProtagonist(id: ProtagonistId, cinematic = true): void {
    if (this.protagonist === id) return;
    this.protagonist = id;
    const info = PROTAGONIST_INFO[id];
    // Swap 3D character rig seamlessly in place
    this.G.scene.remove(this.ped.rig.root);
    this.ped.look = { ...info.look };
    this.ped.rig = buildPerson(this.ped.look, !!this.G.isSoftwareGl);
    this.G.scene.add(this.ped.rig.root);
    this.ped.rig.root.visible = !this.vehicle || this.vehicle.spec.kind === 'cabrio';
    this.ped.sync(0);
    if (cinematic) {
      this.G.cam?.triggerSwitchSwoop();
      this.G.audio?.pickup?.();
      this.G.ui?.toast(`Switched to ${info.name} · ${info.perk}`, 'good');
    }
  }

  switchProtagonist(): void {
    this.setProtagonist(this.protagonist === 'jason' ? 'lucia' : 'jason', true);
  }

  toggleFocus(): void {
    if (this.dead) return;
    if (this.focusActive) {
      this.focusActive = false;
      return;
    }
    if (this.focus > 12) {
      this.focusActive = true;
      this.G.audio?.pickup?.();
    } else {
      this.G.ui?.toast('Focus Recharging', 'info');
    }
  }

  seat(v: Vehicle): void {
    seatDriver(this, v);
  }

  place(x: number, z: number, h: number): void {
    this.x = x;
    this.z = z;
    this.heading = h;
    this.velX = 0;
    this.velZ = 0;
    this.ped.x = x;
    this.ped.z = z;
    this.ped.heading = h;
  }

  hurt(n: number): void {
    if (this.dead || this.G.godMode) return;
    if (this.vehicle) {
      this.vehicle.damage(n * 0.6);
      n *= 0.25;
    }
    const a = Math.min(this.armor, n * 0.7);
    this.armor -= a;
    this.health -= n - a;
    this.G.ui?.flashDamage();
    this.G.cam?.addShake(Math.min(0.45, n * 0.015));
    if (this.health <= 0) {
      this.health = 0;
      this.focusActive = false;
      this.G.events.emit('playerDown', { cause: 'wasted' });
    }
  }

  triggerNearMiss(): void {
    const v = this.vehicle;
    if (!v) return;
    const ev = registerNearMiss(this.stunt, v.speed, v.nitroTier);
    if (ev) {
      this.focus = Math.min(100, this.focus + 12);
      this.G.economy.earn(ev.cash);
      this.G.rep.earn(ev.respect);
      this.G.audio?.pickup();
      this.G.ui.toast(`NEAR MISS x${this.stunt.comboMult} · +${formatMoney(ev.cash)}`, 'rep');
    }
  }

  update(dt: number, realDt = dt): void {
    const G = this.G;
    const I = G.input;
    if (this.dead) {
      this.ped.sync(dt);
      return;
    }

    // GTA VI Focus meter drain / recharge (uses realDt so drain feels crisp in slow-mo)
    if (this.focusActive) {
      const drain = this.protagonist === 'lucia' ? 15 : 22;
      this.focus = Math.max(0, this.focus - drain * realDt);
      if (this.focus <= 0) this.focusActive = false;
    } else {
      const regen = this.protagonist === 'lucia' ? 7.5 : 5.5;
      this.focus = Math.min(100, this.focus + regen * realDt);
    }

    // Global quick-toggles during gameplay
    if (I.pressed('KeyC')) {
      const mode = G.cam.cycleMode();
      G.ui.toast('Camera · ' + mode.toUpperCase());
    }
    if (I.pressed('KeyV')) {
      const next: keyof typeof WEATHER_SPECS = G.sky.cycleWeather();
      G.ui.toast('Atmosphere · ' + WEATHER_SPECS[next].label, 'good');
    }
    if (I.pressed('KeyU')) {
      const muted = G.audio.toggleMute();
      G.ui.toast(muted ? 'Audio Muted' : 'Audio On');
    }
    if (I.pressed('KeyQ')) {
      this.toggleFocus();
    }
    if (I.pressed('KeyF') || I.pressed('Enter')) {
      G.carjack.toggle();
    }

    if (this.vehicle) {
      this.drive(dt);
      return;
    }

    // Ultra-smooth damped on-foot movement (natural momentum & turning)
    this.lastNitroMult = 1;
    const cy = G.cam.yaw;
    let mx = 0;
    let mz = 0;
    if (I.down('KeyW') || I.down('ArrowUp')) mz -= 1;
    if (I.down('KeyS') || I.down('ArrowDown')) mz += 1;
    if (I.down('KeyA') || I.down('ArrowLeft')) mx -= 1;
    if (I.down('KeyD') || I.down('ArrowRight')) mx += 1;
    const len = Math.hypot(mx, mz);
    const sprint = (I.down('ShiftLeft') || I.down('ShiftRight')) && this.stamina > 0.05;
    const aiming = I.mouse.right || I.mouse.left;

    let targetVx = 0;
    let targetVz = 0;
    if (len > 0) {
      mx /= len;
      mz /= len;
      const wx = mx * Math.cos(cy) + mz * Math.sin(cy);
      const wz = -mx * Math.sin(cy) + mz * Math.cos(cy);
      const targetSpd = aiming ? 2.8 : sprint ? 7.6 : 4.5;
      targetVx = wx * targetSpd;
      targetVz = wz * targetSpd;
      if (!aiming) {
        const targetHeading = Math.atan2(-wx, -wz);
        this.heading = wrapAngle(
          this.heading + wrapAngle(targetHeading - this.heading) * (1 - Math.exp(-dt * 12)),
        );
      }
    }
    const accelLambda = len > 0 ? 11 : 13.5;
    this.velX = damp(this.velX, targetVx, accelLambda, dt);
    this.velZ = damp(this.velZ, targetVz, accelLambda, dt);

    this.x += this.velX * dt;
    this.z += this.velZ * dt;
    if (aiming) {
      this.heading = wrapAngle(
        this.heading + wrapAngle(cy - this.heading) * (1 - Math.exp(-dt * 18)),
      );
    }
    this.stamina = clamp(this.stamina + (sprint && len ? -dt * 0.11 : dt * 0.22), 0, 1);

    const r = G.collision.resolve(this.x, this.z, 0.38);
    this.x = r.x;
    this.z = r.z;

    for (const v of G.vehicles as Vehicle[]) {
      const d = Math.hypot(v.x - this.x, v.z - this.z);
      if (d < 2.3 && !v.airborne) {
        const k = (2.3 - d) / (d || 1);
        this.x += (this.x - v.x) * k;
        this.z += (this.z - v.z) * k;
        if (Math.abs(v.speed) > 7 && v.driver) this.hurt(Math.abs(v.speed) * 1.5);
      }
    }

    const spd = Math.hypot(this.velX, this.velZ);
    this.speed = spd;
    const p = this.ped;
    p.x = this.x;
    p.z = this.z;
    p.heading = this.heading;
    p.speed = spd;
    p.aim = aiming && G.combat.current().id !== 'fists';
    p.phase += dt * spd * 4.0;
    p.sync(dt);
  }

  private drive(dt: number): void {
    const G = this.G;
    const I = G.input;
    const v = this.vehicle!;
    const c = v.ctl;
    c.throttle = I.down('KeyW') || I.down('ArrowUp') ? 1 : 0;
    c.brake = I.down('KeyS') || I.down('ArrowDown') ? 1 : 0;
    c.steer =
      (I.down('KeyA') || I.down('ArrowLeft') ? 1 : 0) -
      (I.down('KeyD') || I.down('ArrowRight') ? 1 : 0);
    c.handbrake = I.down('Space');
    c.nitro = I.down('ShiftLeft') || I.down('ShiftRight') || I.down('KeyN');

    // Jason's Apex Driver perk: faster nitrous recharge
    if (this.protagonist === 'jason' && !c.nitro) {
      this.stunt.nitro = Math.min(100, this.stunt.nitro + dt * 4.5);
    }

    const { events, nitroMultiplier } = stepStuntState(this.stunt, {
      dt,
      speed: v.speed,
      lateralSpeed: v.lat,
      airborne: v.airborne,
      height: v.y,
      wantNitro: c.nitro,
      nitroTier: v.nitroTier,
      handbrake: c.handbrake,
      crashedHard: v.crashedHard,
    });
    v.boosting = this.stunt.boosting;
    this.lastNitroMult = nitroMultiplier;

    for (const ev of events) {
      this.focus = Math.min(100, this.focus + 14);
      G.economy.earn(ev.cash);
      G.rep.earn(ev.respect);
      G.audio?.stuntBonus();
      if (ev.kind === 'jump') {
        G.ui.missionBanner(ev.label, `+${formatMoney(ev.cash)} · RESPECT +${ev.respect}`, 'pass');
      } else {
        G.ui.toast(`${ev.label} · +${formatMoney(ev.cash)}`, 'rep');
      }
    }

    if (I.pressed('KeyH')) G.audio?.horn();
    if (I.pressed('KeyR')) G.radio?.next();

    this.x = v.x;
    this.z = v.z;
    this.heading = v.heading;
    this.speed = v.speed;
    this.ped.x = v.x;
    this.ped.z = v.z;
    this.seat(v);
    if (v.dead) {
      G.carjack.exit(true);
      this.hurt(40);
    }
  }
}

export function seatDriver(P: PlayerController, v: Vehicle): void {
  const open = v.spec.kind === 'cabrio' && !v.dead;
  const rig = P.ped.rig;
  rig.root.visible = open;
  if (!open) return;
  const rx = -v.fz;
  const rz = v.fx;
  rig.root.position.set(
    v.x - rx * 0.42 - v.fx * 0.25,
    v.y,
    v.z - rz * 0.42 - v.fz * 0.25,
  );
  rig.root.rotation.y = v.heading;
  animatePerson(rig, 0, 'drive', false, 0.016);
}

export function respawnAt(G: any, x: number, z: number): void {
  const P = G.player as PlayerController;
  P.dead = false;
  P.health = 100;
  P.focus = 100;
  P.focusActive = false;
  P.ped.dead = false;
  P.ped.state = 'idle';
  P.ped.health = 100;
  P.place(x, z, 0);
  P.ped.rig.root.visible = true;
  P.ped.sync(0);
  G.cam.snap = true;
}
