// Carjacking: F takes the nearest car (drivers dragged out, witnesses alert PCPD); F again leaves it.
import { Ped } from '../people/Pedestrians.ts';
import { randomLook } from '../people/PersonModel.ts';
import { Rng } from '../core/MathUtil.ts';
import type { Vehicle } from './Vehicle.ts';

export class Carjacking {
  private rng = new Rng(5);

  constructor(private G: any) {}

  nearest(maxD = 5.6): Vehicle | null {
    const P = this.G.player;
    let best: Vehicle | null = null;
    let bd = maxD;
    for (const v of this.G.vehicles as Vehicle[]) {
      if (v.dead) continue;
      const d = Math.hypot(v.x - P.x, v.z - P.z);
      if (d < bd) {
        bd = d;
        best = v;
      }
    }
    return best;
  }

  toggle(): void {
    if (this.G.player.vehicle) this.exit(false);
    else this.enter(this.nearest());
  }

  enter(v: Vehicle | null): boolean {
    if (!v) return false;
    const G = this.G;
    const P = G.player;
    if (v.driver === 'ai' || v.driver === 'police') {
      const thrown = new Ped(
        G,
        randomLook(this.rng),
        v.x + -v.fz * 2,
        v.z + v.fx * 2,
        v.role === 'police' ? 'cop' : 'civ',
      );
      if (v.role === 'police') {
        thrown.weaponDmg = 6;
        thrown.accuracy = 0.4;
        thrown.state = 'attack';
      } else {
        thrown.state = 'flee';
        thrown.fleeT = 10;
        thrown.threat = [P.x, P.z];
        thrown.ring = {
          x0: v.x - 20,
          z0: v.z - 20,
          x1: v.x + 20,
          z1: v.z + 20,
        };
      }
      G.peds.push(thrown);
      G.wanted.crime(v.role === 'police' ? 'stealCop' : 'carjack', v.x, v.z);
    } else if (v.role === 'police') {
      G.wanted.crime('stealCop', v.x, v.z);
    } else if (v.role === 'parked' && this.rng.chance(0.25)) {
      G.wanted.crime('theft', v.x, v.z);
    }

    // Intercepting the Armored Cash Van awards an immediate jackpot!
    if (v.role === 'cashvan' && !v.dead) {
      G.economy.earn(1500);
      G.rep.earn(35, 'Armored Van Hijack');
      G.wanted.crime('heist', v.x, v.z);
      G.ui.toast('SYNDICATE VAULT VAN HIJACKED · +$1,500', 'good');
    }

    v.driver = 'player';
    v.role = v.role === 'mission' ? 'mission' : 'stolen';
    v.lane = null;
    P.vehicle = v;
    P.seat(v);
    G.ui.toast(
      (v.role === 'mission' ? 'Boarded ' : 'Entered ') + v.spec.name,
      'alert',
    );
    G.audio?.door();
    G.radio?.carEntered(v);
    G.events.emit('enterVehicle', v);
    return true;
  }

  exit(forced: boolean): void {
    const G = this.G;
    const P = G.player;
    const v = P.vehicle as Vehicle | null;
    if (!v) return;
    if (!forced && Math.abs(v.speed) > 7) return;
    v.driver = null;
    v.boosting = false;
    v.ctl.throttle = 0;
    v.ctl.brake = 0.5;
    v.ctl.handbrake = true;
    P.vehicle = null;
    const sx = v.x + -v.fz * -2.4;
    const sz = v.z + v.fx * -2.4;
    const r = G.collision.resolve(sx, sz, 0.4);
    P.place(r.x, r.z, v.heading);
    P.ped.rig.root.visible = true;
    G.audio?.door();
    G.radio?.carLeft();
    G.events.emit('exitVehicle', v);
  }
}
