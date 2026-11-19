// Particles: pooled sprites for fire, sparks, smoke, blood, tracers and explosion flashes.
import * as THREE from 'three';
import {
    glowTexture,
    smokeTexture
} from '../render/Textures.js';

const VERT = `attribute float size; attribute vec4 tint; varying vec4 vT;
void main(){ vT = tint; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = size * 900.0 / max(1.0, -mv.z); gl_Position = projectionMatrix * mv; }`;
const FRAG = 'uniform sampler2D map; varying vec4 vT; void main(){ vec4 t = texture2D(map, gl_PointCoord); gl_FragColor = vec4(vT.rgb * t.rgb, vT.a * t.a); }';

class Pool {
    constructor(scene, n, additive, tex) {
        this.n = n;
        this.p = [];
        this.i = 0;
        this.pos = new Float32Array(n * 3);
        this.size = new Float32Array(n);
        this.tint = new Float32Array(n * 4);
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
        g.setAttribute('size', new THREE.BufferAttribute(this.size, 1));
        g.setAttribute('tint', new THREE.BufferAttribute(this.tint, 4));
        const m = new THREE.ShaderMaterial({
            vertexShader: VERT,
            fragmentShader: FRAG,
            uniforms: {
                map: {
                    value: tex
                }
            },
            transparent: true,
            depthWrite: false,
            blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending
        });
        this.mesh = new THREE.Points(g, m);
        this.mesh.frustumCulled = false;
        scene.add(this.mesh);
        for (let k = 0; k < n; k++) this.p.push({
            life: 0
        });
    }
    emit(o) {
        const p = this.p[this.i];
        this.i = (this.i + 1) % this.n;
        Object.assign(p, {
            g: 0,
            drag: 1,
            grow: 0
        }, o, {
            max: o.life
        });
    }
    update(dt) {
        for (let k = 0; k < this.n; k++) {
            const p = this.p[k];
            if (p.life <= 0) {
                this.size[k] = 0;
                this.tint[k * 4 + 3] = 0;
                continue;
            }
            p.life -= dt;
            const t = 1 - p.life / p.max;
            p.vy -= p.g * dt;
            const dr = Math.pow(p.drag, dt);
            p.vx *= dr;
            p.vy *= dr;
            p.vz *= dr;
            p.x += p.vx * dt;
            p.y = Math.max(0.05, p.y + p.vy * dt);
            p.z += p.vz * dt;
            this.pos.set([p.x, p.y, p.z], k * 3);
            this.size[k] = p.s + p.grow * t;
            const c = p.c0,
                e = p.c1 || p.c0;
            this.tint.set([c[0] + (e[0] - c[0]) * t, c[1] + (e[1] - c[1]) * t, c[2] + (e[2] - c[2]) * t, p.a * (1 - t * t)], k * 4);
        }
        const g = this.mesh.geometry;
        g.attributes.position.needsUpdate = true;
        g.attributes.size.needsUpdate = true;
        g.attributes.tint.needsUpdate = true;
    }
}

export class Particles {
    constructor(G) {
        this.G = G;
        this.glow = new Pool(G.scene, 700, true, glowTexture());
        this.smokeP = new Pool(G.scene, 500, false, smokeTexture());
        this.tracerPos = new Float32Array(64 * 6);
        this.tracerCol = new Float32Array(64 * 6);
        this.tracerLife = new Float32Array(64);
        this.ti = 0;
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.BufferAttribute(this.tracerPos, 3));
        g.setAttribute('color', new THREE.BufferAttribute(this.tracerCol, 3));
        this.tracers = new THREE.LineSegments(g, new THREE.LineBasicMaterial({
            vertexColors: true,
            transparent: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        }));
        this.tracers.frustumCulled = false;
        G.scene.add(this.tracers);
        this.flash = new THREE.PointLight(0xffa040, 0, 40, 1.6);
        G.scene.add(this.flash);
    }
    r(a) {
        return (Math.random() - 0.5) * a;
    }
    sparks(x, y, z, n) {
        for (let i = 0; i < n; i++) this.glow.emit({
            x,
            y,
            z,
            vx: this.r(10),
            vy: Math.random() * 6,
            vz: this.r(10),
            g: 18,
            life: 0.35,
            s: 0.12,
            a: 1,
            c0: [4, 2.6, 1.2],
            c1: [2, 0.6, 0.1],
            drag: 0.2
        });
    }
    muzzle(x, y, z) {
        this.glow.emit({
            x,
            y,
            z,
            vx: 0,
            vy: 0,
            vz: 0,
            life: 0.06,
            s: 0.5,
            a: 1,
            c0: [6, 4, 1.8]
        });
        this.flash.position.set(x, y, z);
        this.flash.intensity = Math.max(this.flash.intensity, 25);
    }
    blood(x, y, z) {
        for (let i = 0; i < 6; i++) this.smokeP.emit({
            x,
            y,
            z,
            vx: this.r(3),
            vy: Math.random() * 2,
            vz: this.r(3),
            g: 9,
            life: 0.5,
            s: 0.18,
            a: 0.9,
            c0: [0.5, 0.02, 0.02]
        });
    }
    smoke(x, y, z, black) {
        this.smokeP.emit({
            x: x + this.r(0.5),
            y,
            z: z + this.r(0.5),
            vx: this.r(0.6),
            vy: 1.6,
            vz: this.r(0.6),
            life: 2.2,
            s: 0.5,
            grow: 2.2,
            a: black ? 0.75 : 0.45,
            c0: black ? [0.08, 0.08, 0.08] : [0.75, 0.75, 0.75],
            c1: black ? [0.15, 0.15, 0.15] : [0.9, 0.9, 0.9]
        });
    }
    tyreSmoke(x, z) {
        this.smokeP.emit({
            x: x + this.r(1),
            y: 0.3,
            z: z + this.r(1),
            vx: this.r(1),
            vy: 0.7,
            vz: this.r(1),
            life: 1.4,
            s: 0.6,
            grow: 2.5,
            a: 0.4,
            c0: [0.92, 0.9, 0.88]
        });
    }
    dust(x, z) {
        this.smokeP.emit({
            x,
            y: 0.2,
            z,
            vx: this.r(2),
            vy: 0.6,
            vz: this.r(2),
            life: 1,
            s: 0.5,
            grow: 1.4,
            a: 0.35,
            c0: [0.85, 0.75, 0.6]
        });
    }
    fire(x, y, z) {
        this.glow.emit({
            x: x + this.r(1.6),
            y,
            z: z + this.r(1.6),
            vx: this.r(0.6),
            vy: 2.4 + Math.random() * 1.5,
            vz: this.r(0.6),
            life: 0.7,
            s: 0.9,
            grow: -0.5,
            a: 0.9,
            c0: [5, 2.2, 0.5],
            c1: [1.6, 0.2, 0.05]
        });
        if (Math.random() < 0.4) this.smoke(x, y + 2, z, true);
    }
    explosion(x, y, z) {
        for (let i = 0; i < 70; i++) this.glow.emit({
            x,
            y,
            z,
            vx: this.r(16),
            vy: Math.random() * 12,
            vz: this.r(16),
            g: 6,
            drag: 0.15,
            life: 0.9 + Math.random() * 0.5,
            s: 1.4,
            grow: 1.5,
            a: 1,
            c0: [7, 3.4, 0.9],
            c1: [1.5, 0.2, 0.05]
        });
        for (let i = 0; i < 30; i++) this.smoke(x + this.r(3), y + Math.random() * 3, z + this.r(3), true);
        this.sparks(x, y, z, 30);
        this.flash.position.set(x, y + 2, z);
        this.flash.intensity = 400;
        const P = this.G.player;
        if (Math.hypot(P.x - x, P.z - z) < 40) this.G.cam.addShake(1 - Math.hypot(P.x - x, P.z - z) / 40);
    }
    tracer(ax, ay, az, bx, by, bz, color) {
        const i = this.ti;
        this.ti = (this.ti + 1) % 64;
        const len = Math.hypot(bx - ax, by - ay, bz - az) || 1,
            cut = Math.min(1, 6 / len),
            t0 = Math.random() * (1 - cut);
        this.tracerPos.set([ax + (bx - ax) * t0, ay + (by - ay) * t0, az + (bz - az) * t0, ax + (bx - ax) * (t0 + cut), ay + (by - ay) * (t0 + cut), az + (bz - az) * (t0 + cut)], i * 6);
        const c = new THREE.Color(color).multiplyScalar(4);
        this.tracerCol.set([c.r, c.g, c.b, c.r, c.g, c.b], i * 6);
        this.tracerLife[i] = 0.07;
    }
    update(dt) {
        this.glow.update(dt);
        this.smokeP.update(dt);
        for (let i = 0; i < 64; i++)
            if (this.tracerLife[i] > 0 && (this.tracerLife[i] -= dt) <= 0) this.tracerCol.fill(0, i * 6, i * 6 + 6);
        this.tracers.geometry.attributes.position.needsUpdate = true;
        this.tracers.geometry.attributes.color.needsUpdate = true;
        this.flash.intensity *= Math.pow(0.002, dt);
    }
}