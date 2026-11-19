// PlayerController: Nico Varela on foot and at the wheel, health, armour, wasted and respawn.
import {
    Ped
} from '../people/Pedestrians.js';
import {
    clamp,
    wrapAngle
} from '../core/MathUtil.js';
import {
    animatePerson
} from '../people/PersonModel.js';

export const NICO_LOOK = {
    skin: '#b9825c',
    hair: '#17110d',
    shirt: '#1f9e8f',
    tee: '#f4efe6',
    pants: '#2b2f3a',
    shoe: '#efe9dd',
    shades: true,
    longSleeve: false,
    vest: null,
    scale: 1.02
};

export class PlayerController {
    constructor(G) {
        this.G = G;
        this.ped = new Ped(G, { ...NICO_LOOK,
            shirtPrint: true
        }, 0, 0, 'player');
        this.health = 100;
        this.armor = 0;
        this.vehicle = null;
        this.dead = false;
        this.stamina = 1;
        this.x = 0;
        this.z = 0;
        this.heading = 0;
        this.speed = 0;
    }

    seat(v) {
        seatDriver(this, v);
    }
    place(x, z, h) {
        this.x = x;
        this.z = z;
        this.heading = h;
        this.ped.x = x;
        this.ped.z = z;
        this.ped.heading = h;
    }

    hurt(n) {
        if (this.dead || this.G.godMode) return;
        if (this.vehicle) {
            this.vehicle.damage(n * 0.6);
            n *= 0.25;
        }
        const a = Math.min(this.armor, n * 0.7);
        this.armor -= a;
        this.health -= n - a;
        this.G.hud ? .flashDamage();
        if (this.health <= 0) {
            this.health = 0;
            this.G.events.emit('playerDown', {
                cause: 'wasted'
            });
        }
    }

    update(dt) {
        const G = this.G,
            I = G.input;
        if (this.dead) {
            this.ped.sync(dt);
            return;
        }
        if (I.pressed('KeyF') || I.pressed('Enter')) G.carjack.toggle();
        if (this.vehicle) return this.drive(dt);
        // on foot
        const cy = G.cam.yaw;
        let mx = 0,
            mz = 0;
        if (I.down('KeyW')) mz -= 1;
        if (I.down('KeyS')) mz += 1;
        if (I.down('KeyA')) mx -= 1;
        if (I.down('KeyD')) mx += 1;
        const len = Math.hypot(mx, mz);
        const sprint = I.down('ShiftLeft') && this.stamina > 0.05;
        const aiming = I.mouse.right || I.mouse.left;
        let spd = 0;
        if (len > 0) {
            mx /= len;
            mz /= len;
            const wx = mx * Math.cos(cy) + mz * Math.sin(cy),
                wz = -mx * Math.sin(cy) + mz * Math.cos(cy);
            spd = aiming ? 2.6 : sprint ? 7.2 : 4.2;
            this.x += wx * spd * dt;
            this.z += wz * spd * dt;
            if (!aiming) this.heading = this.heading + wrapAngle(Math.atan2(-wx, -wz) - this.heading) * Math.min(1, dt * 12);
        }
        if (aiming) this.heading = cy;
        this.stamina = clamp(this.stamina + (sprint && len ? -dt * 0.12 : dt * 0.2), 0, 1);
        const r = G.collision.resolve(this.x, this.z, 0.38);
        this.x = r.x;
        this.z = r.z;
        for (const v of G.vehicles) { // stand clear of cars, get knocked by fast ones
            const d = Math.hypot(v.x - this.x, v.z - this.z);
            if (d < 2.3) {
                const k = (2.3 - d) / (d || 1);
                this.x += (this.x - v.x) * k;
                this.z += (this.z - v.z) * k;
                if (Math.abs(v.speed) > 7 && v.driver) this.hurt(Math.abs(v.speed) * 1.5);
            }
        }
        this.speed = spd;
        const p = this.ped;
        p.x = this.x;
        p.z = this.z;
        p.heading = this.heading;
        p.speed = spd;
        p.aim = aiming && G.combat.current().id !== 'fists';
        p.phase += dt * spd * 4.2;
        p.sync(dt);
    }

    drive(dt) {
        const G = this.G,
            I = G.input,
            v = this.vehicle;
        const c = v.ctl;
        c.throttle = I.down('KeyW') || I.down('ArrowUp') ? 1 : 0;
        c.brake = I.down('KeyS') || I.down('ArrowDown') ? 1 : 0;
        c.steer = (I.down('KeyA') || I.down('ArrowLeft') ? 1 : 0) - (I.down('KeyD') || I.down('ArrowRight') ? 1 : 0);
        c.handbrake = I.down('Space');
        if (I.pressed('KeyH')) G.audio ? .horn();
        if (I.pressed('KeyR')) G.radio ? .next();
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

// With the top down (the Palma Cabrio) Nico stays in view, seated on the driver's side.
export function seatDriver(P, v) {
    const open = v.spec.kind === 'cabrio' && !v.dead,
        rig = P.ped.rig;
    rig.root.visible = open;
    if (!open) return;
    const rx = -v.fz,
        rz = v.fx; // the car's right
    rig.root.position.set(v.x - rx * 0.42 - v.fx * 0.25, 0, v.z - rz * 0.42 - v.fz * 0.25);
    rig.root.rotation.y = v.heading;
    animatePerson(rig, 0, 'drive', false, 0.016);
}

export function respawnAt(G, x, z) {
    const P = G.player;
    P.dead = false;
    P.health = 100;
    P.ped.dead = false;
    P.ped.state = 'idle';
    P.ped.health = 100;
    P.place(x, z, 0);
    P.ped.rig.root.visible = true;
    P.ped.sync(0);
    G.cam.snap = true;
}