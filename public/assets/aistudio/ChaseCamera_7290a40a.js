// ChaseCamera: over-the-shoulder orbit on foot, speed-aware chase cam in cars, shake, wall avoidance.
import * as THREE from 'three';
import {
    clamp,
    damp,
    wrapAngle
} from '../core/MathUtil.js';

export class ChaseCamera {
    constructor(G) {
        this.G = G;
        this.yaw = 0;
        this.pitch = 0.22;
        this.dist = 4.6;
        this.lookTimer = 0;
        this.shake = 0;
        this.snap = true;
        this.pos = new THREE.Vector3();
        this.look = new THREE.Vector3();
        this.override = null;
    }

    addShake(n) {
        this.shake = Math.min(1.2, this.shake + n);
    }

    update(dt) {
        const G = this.G,
            P = G.player,
            I = G.input,
            cam = G.camera;
        if (this.override) {
            this.override(cam, dt);
            return;
        }
        const mdx = I.mouse.dx,
            mdy = I.mouse.dy;
        this.yaw -= mdx * 0.0026;
        this.pitch = clamp(this.pitch + mdy * 0.002, -0.25, 1.1);
        let tx, ty, tz, dist, height, fov;
        if (P.vehicle) {
            const v = P.vehicle,
                sp = Math.abs(v.speed);
            if (Math.abs(mdx) + Math.abs(mdy) > 0.5) this.lookTimer = 1.6;
            this.lookTimer -= dt;
            if (this.lookTimer <= 0) {
                const behind = v.speed < -2 ? v.heading + Math.PI : v.heading;
                this.yaw += wrapAngle(behind - this.yaw) * Math.min(1, dt * (2.2 + sp * 0.05));
                this.pitch = damp(this.pitch, 0.2, 2, dt);
            }
            dist = 7.6 + v.spec.len * 0.4 + sp * 0.06;
            height = 1.6 + v.spec.h * 0.6;
            fov = 60 + clamp(sp, 0, 50) * 0.32;
            tx = v.x;
            ty = 1.3 + v.spec.h * 0.4;
            tz = v.z;
            G.post.params.speedBlur = clamp((sp - 22) / 30, 0, 1);
        } else {
            const aim = I.mouse.right || I.mouse.left;
            dist = aim ? 3.3 : 4.4;
            height = 0.6;
            fov = aim ? 56 : 62;
            const sh = aim ? 1.05 : 0.5,
                sx = Math.cos(this.yaw) * sh,
                sz = -Math.sin(this.yaw) * sh;
            tx = P.x + sx;
            ty = 1.62;
            tz = P.z + sz;
            G.post.params.speedBlur = 0;
        }
        const cp = Math.cos(this.pitch),
            ox = Math.sin(this.yaw) * cp * dist,
            oz = Math.cos(this.yaw) * cp * dist,
            oy = Math.sin(this.pitch) * dist + height;
        const want = new THREE.Vector3(tx + ox, ty + oy, tz + oz);
        // keep the camera out of buildings: pull it in along the ray
        const dir = new THREE.Vector3(ox, 0, oz),
            dl = dir.length();
        if (dl > 0.1) {
            dir.divideScalar(dl);
            const hit = G.collision.ray(tx, tz, dir.x, dir.z, dl, want.y);
            if (hit < dl) {
                want.x = tx + dir.x * (hit - 0.6);
                want.z = tz + dir.z * (hit - 0.6);
            }
        }
        if (this.snap) {
            this.pos.copy(want);
            this.look.set(tx, ty, tz);
            this.snap = false;
        }
        this.pos.lerp(want, 1 - Math.exp(-dt * (P.vehicle ? 7 : 14)));
        this.look.lerp(new THREE.Vector3(tx, ty, tz), 1 - Math.exp(-dt * 16));
        cam.position.copy(this.pos);
        if (this.shake > 0) {
            this.shake = Math.max(0, this.shake - dt * 2);
            cam.position.x += (Math.random() - 0.5) * this.shake * 0.4;
            cam.position.y += (Math.random() - 0.5) * this.shake * 0.3;
        }
        cam.lookAt(this.look);
        cam.fov = damp(cam.fov, fov, 4, dt);
        cam.updateProjectionMatrix();
    }

    // Unit vector the camera faces on the ground plane (used for aiming).
    forward() {
        return [-Math.sin(this.yaw), -Math.cos(this.yaw)];
    }
}