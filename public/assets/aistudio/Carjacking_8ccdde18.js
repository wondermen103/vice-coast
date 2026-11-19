// Carjacking: F takes the nearest car (drivers dragged out, witnesses call the PCPD); F again leaves it.
import {
    Ped
} from '../people/Pedestrians.js';
import {
    randomLook
} from '../people/PersonModel.js';
import {
    Rng
} from '../core/MathUtil.js';

export class Carjacking {
    constructor(G) {
        this.G = G;
        this.rng = new Rng(5);
    }

    nearest(maxD = 5.5) {
        const P = this.G.player;
        let best = null,
            bd = maxD;
        for (const v of this.G.vehicles) {
            if (v.dead) continue;
            const d = Math.hypot(v.x - P.x, v.z - P.z);
            if (d < bd) {
                bd = d;
                best = v;
            }
        }
        return best;
    }

    toggle() {
        if (this.G.player.vehicle) this.exit(false);
        else this.enter(this.nearest());
    }

    enter(v) {
        if (!v) return false;
        const G = this.G,
            P = G.player;
        if (v.driver === 'ai' || v.driver === 'police') {
            const thrown = new Ped(G, randomLook(this.rng), v.x + (-v.fz) * 2, v.z + v.fx * 2, v.role === 'police' ? 'cop' : 'civ');
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
                    z1: v.z + 20
                };
            }
            G.peds.push(thrown);
            G.wanted.crime(v.role === 'police' ? 'stealCop' : 'carjack', v.x, v.z);
        } else if (v.role === 'police') G.wanted.crime('stealCop', v.x, v.z);
        else if (v.role === 'parked' && this.rng.chance(0.25)) G.wanted.crime('theft', v.x, v.z);
        v.driver = 'player';
        v.role = v.role === 'mission' ? 'mission' : 'stolen';
        v.lane = null;
        P.vehicle = v;
        P.seat(v); // hidden in a hardtop, seated in view in a cabrio
        G.hud ? .toast((v.role === 'mission' ? 'Got the ' : 'Vehicle stolen · ') + v.spec.name, 'alert');
        G.audio ? .door();
        G.radio ? .carEntered(v);
        G.events.emit('enterVehicle', v);
        return true;
    }

    exit(forced) {
        const G = this.G,
            P = G.player,
            v = P.vehicle;
        if (!v) return;
        if (!forced && Math.abs(v.speed) > 6) return;
        v.driver = null;
        v.ctl.throttle = 0;
        v.ctl.brake = 0.5;
        v.ctl.handbrake = true;
        P.vehicle = null;
        const sx = v.x + (-v.fz) * -2.4,
            sz = v.z + v.fx * -2.4,
            r = G.collision.resolve(sx, sz, 0.4);
        P.place(r.x, r.z, v.heading);
        P.ped.rig.root.visible = true;
        G.audio ? .door();
        G.radio ? .carLeft();
        G.events.emit('exitVehicle', v);
    }
}