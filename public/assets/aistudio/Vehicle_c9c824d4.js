// Vehicle: arcade driving physics, drifts, collisions, damage, smoke and explosions. Heading 0 faces north.
import {
    buildCar,
    CAR_SPECS
} from './CarModels.js';
import {
    clamp,
    damp,
    wrapAngle
} from '../core/MathUtil.js';

let NEXT_ID = 1;
export class Vehicle {
    constructor(G, model, paint, x, z, heading) {
        this.G = G;
        this.id = NEXT_ID++;
        this.model = model;
        this.spec = CAR_SPECS[model];
        Object.assign(this, buildCar(model, paint));
        this.paint = paint;
        this.x = x;
        this.z = z;
        this.heading = heading;
        this.speed = 0;
        this.lat = 0;
        this.steer = 0;
        this.yawRate = 0;
        this.health = 100 * this.spec.mass;
        this.maxHealth = this.health;
        this.driver = null;
        this.role = 'parked';
        this.siren = false;
        this.dead = false;
        this.burn = 0;
        this.upgrade = 0;
        this.armor = 0;
        this.lightsOn = false;
        this.flash = Math.random() * 10;
        this.ctl = {
            throttle: 0,
            brake: 0,
            steer: 0,
            handbrake: false
        };
        this.radius = this.spec.wid * 0.55;
        G.scene.add(this.group);
        this.sync(0);
    }

    get fx() {
        return -Math.sin(this.heading);
    }
    get fz() {
        return -Math.cos(this.heading);
    }

    update(dt) {
        const s = this.spec,
            c = this.ctl;
        if (this.frozen) {
            this.sync(dt);
            return;
        } // posed by a screenshot scene
        if (this.dead) {
            this.speed = damp(this.speed, 0, 2, dt);
            this.lat = damp(this.lat, 0, 3, dt);
        } else {
            const top = s.top * (1 + this.upgrade * 0.12),
                acc = s.acc * (1 + this.upgrade * 0.15);
            if (c.throttle > 0) this.speed += c.throttle * acc * Math.max(0.15, 1 - this.speed / top) * dt;
            if (c.brake > 0) this.speed -= c.brake * (this.speed > 0.5 ? 26 : 7) * dt * (this.speed < -12 ? 0 : 1);
            if (!c.throttle && !c.brake) this.speed = damp(this.speed, 0, 0.35, dt);
            if (c.handbrake) this.speed = damp(this.speed, 0, 1.1, dt);
            this.speed = clamp(this.speed, -14, top);
        }
        const sp = Math.abs(this.speed);
        this.steer = damp(this.steer, c.steer, 8, dt);
        const steerGain = 1.9 / (1 + sp * 0.045) * clamp(sp / 5, 0, 1);
        const yaw = this.steer * steerGain * Math.sign(this.speed || 1);
        this.yawRate = yaw;
        this.heading = wrapAngle(this.heading + yaw * dt * (c.handbrake ? 1.45 : 1));
        // lateral slip: builds in hard turns and handbrake slides, decays with grip
        const slipIn = c.handbrake ? 0.55 : 0.12;
        this.lat += -yaw * this.speed * slipIn * dt * 2;
        this.lat = damp(this.lat, 0, c.handbrake ? 1.2 : s.grip, dt);
        const rx = -this.fz,
            rz = this.fx;
        let nx = this.x + (this.fx * this.speed + rx * this.lat) * dt;
        let nz = this.z + (this.fz * this.speed + rz * this.lat) * dt;
        // two collision circles along the body
        let hitN = null;
        for (const o of [-0.3, 0.3]) {
            const cx = nx + this.fx * s.len * o,
                cz = nz + this.fz * s.len * o;
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
                this.damage(into * 1.4);
                this.G.fx ? .sparks(nx + this.fx * 2, 0.6, nz + this.fz * 2, 10);
                this.G.audio ? .crash(into / 30);
            }
            this.speed *= into > 0 ? 0.45 : 0.9;
            this.lat *= 0.5;
        }
        this.x = nx;
        this.z = nz;
        if (this.health < this.maxHealth * 0.35 && !this.dead && Math.random() < dt * 8) this.G.fx ? .smoke(this.x + this.fx * 1.8, 1.1, this.z + this.fz * 1.8, this.health < this.maxHealth * 0.15 ? 1 : 0);
        if (this.dead && this.burn > 0) {
            this.burn -= dt;
            if (Math.random() < dt * 20) this.G.fx ? .fire(this.x, 1.2, this.z);
        }
        if (sp > 8 && (c.handbrake || Math.abs(this.lat) > 3.5) && Math.random() < dt * 30) this.G.fx ? .tyreSmoke(this.x - this.fx * 1.6, this.z - this.fz * 1.6);
        this.sync(dt);
    }

    sync(dt) {
        const g = this.group;
        g.position.set(this.x, 0, this.z);
        g.rotation.y = this.heading;
        g.rotation.z = damp(g.rotation.z, clamp(this.lat * 0.025 + this.yawRate * this.speed * 0.004, -0.09, 0.09), 6, dt || 1);
        g.rotation.x = damp(g.rotation.x, clamp(-(this.ctl.throttle - this.ctl.brake) * 0.02, -0.03, 0.03), 5, dt || 1);
        for (const w of this.wheels) {
            w.rotation.x -= this.speed * dt / 0.37;
            if (w.userData.front) w.rotation.y = this.steer * 0.45;
            w.rotation.order = 'YXZ';
        }
        const night = this.G.sky ? this.G.sky.night + (this.G.sky.sunDir.y < 0.2 ? 0.6 : 0) : 0;
        for (let i = 0; i < this.glows.length; i++) {
            const head = i % 2 === 0;
            this.glows[i].visible = !this.dead && (head ? night > 0.3 : (night > 0.3 || this.ctl.brake > 0));
            if (!head) this.glows[i].scale.setScalar(this.ctl.brake > 0 ? 1.7 : 1.0);
        }
        if (this.bar) {
            this.flash += dt * 9;
            const on = this.siren && !this.dead,
                a = Math.sin(this.flash) > 0,
                b = Math.sin(this.flash * 1.37 + 1) > 0;
            this.bar.rg.visible = on && a;
            this.bar.bg.visible = on && !a;
            this.bar.red.material.color.setRGB(on && a ? 4 : 0.4, 0.05, 0.08);
            this.bar.blue.material.color.setRGB(0.05, 0.2, on && !a ? 5 : 0.5);
            if (b && on) {
                this.bar.rg.scale.setScalar(5);
                this.bar.bg.scale.setScalar(5);
            } else {
                this.bar.rg.scale.setScalar(3.6);
                this.bar.bg.scale.setScalar(3.6);
            }
        }
    }

    damage(n) {
        if (this.dead) return;
        this.health -= n * (1 - this.armor * 0.2);
        if (this.health <= 0) this.explode();
    }

    explode() {
        this.dead = true;
        this.health = 0;
        this.burn = 14;
        this.paintMat.color.set('#2a2522');
        this.paintMat.clearcoat = 0;
        this.paintMat.metalness = 0;
        this.G.fx ? .explosion(this.x, 1, this.z);
        this.G.audio ? .explosion();
        this.G.events.emit('explosion', {
            x: this.x,
            z: this.z,
            vehicle: this
        });
    }

    dispose() {
        this.G.scene.remove(this.group);
    }
}