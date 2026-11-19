// Particles: zero-GC pooled sprites for fire, sparks, smoke, blood, nitrous flames, tracers, and flashes.
import * as THREE from 'three';
import { glowTexture, smokeTexture } from '../render/Textures.ts';

const VERT = `attribute float size; attribute vec4 tint; varying vec4 vT;
void main(){ vT = tint; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = size * 900.0 / max(1.0, -mv.z); gl_Position = projectionMatrix * mv; }`;
const FRAG =
  'uniform sampler2D map; varying vec4 vT; void main(){ vec4 t = texture2D(map, gl_PointCoord); gl_FragColor = vec4(vT.rgb * t.rgb, vT.a * t.a); }';

interface ParticleSlot {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  g: number;
  drag: number;
  life: number;
  max: number;
  s: number;
  grow: number;
  a: number;
  c0: [number, number, number];
  c1: [number, number, number];
}

class Pool {
  private p: ParticleSlot[] = [];
  private i = 0;
  private pos: Float32Array;
  private size: Float32Array;
  private tint: Float32Array;
  private mesh: THREE.Points;

  constructor(
    scene: THREE.Scene,
    private n: number,
    additive: boolean,
    tex: THREE.Texture,
  ) {
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
      uniforms: { map: { value: tex } },
      transparent: true,
      depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    this.mesh = new THREE.Points(g, m);
    this.mesh.frustumCulled = false;
    scene.add(this.mesh);
    for (let k = 0; k < n; k++) {
      this.p.push({
        x: 0,
        y: 0,
        z: 0,
        vx: 0,
        vy: 0,
        vz: 0,
        g: 0,
        drag: 1,
        life: 0,
        max: 1,
        s: 0.2,
        grow: 0,
        a: 1,
        c0: [1, 1, 1],
        c1: [1, 1, 1],
      });
    }
  }

  emit(o: Partial<ParticleSlot> & { x: number; y: number; z: number; life: number; s: number; a: number; c0: [number, number, number] }): void {
    const slot = this.p[this.i];
    this.i = (this.i + 1) % this.n;
    slot.x = o.x;
    slot.y = o.y;
    slot.z = o.z;
    slot.vx = o.vx ?? 0;
    slot.vy = o.vy ?? 0;
    slot.vz = o.vz ?? 0;
    slot.g = o.g ?? 0;
    slot.drag = o.drag ?? 1;
    slot.life = o.life;
    slot.max = o.life;
    slot.s = o.s;
    slot.grow = o.grow ?? 0;
    slot.a = o.a;
    slot.c0 = o.c0;
    slot.c1 = o.c1 ?? o.c0;
  }

  update(dt: number): void {
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
      this.pos[k * 3] = p.x;
      this.pos[k * 3 + 1] = p.y;
      this.pos[k * 3 + 2] = p.z;
      this.size[k] = p.s + p.grow * t;
      const c = p.c0;
      const e = p.c1;
      this.tint[k * 4] = c[0] + (e[0] - c[0]) * t;
      this.tint[k * 4 + 1] = c[1] + (e[1] - c[1]) * t;
      this.tint[k * 4 + 2] = c[2] + (e[2] - c[2]) * t;
      this.tint[k * 4 + 3] = p.a * (1 - t * t);
    }
    const g = this.mesh.geometry;
    g.attributes.position.needsUpdate = true;
    g.attributes.size.needsUpdate = true;
    g.attributes.tint.needsUpdate = true;
  }
}

export class Particles {
  private glow: Pool;
  private smokeP: Pool;
  private tracerPos = new Float32Array(64 * 6);
  private tracerCol = new Float32Array(64 * 6);
  private tracerLife = new Float32Array(64);
  private ti = 0;
  private tracers: THREE.LineSegments;
  private flash: THREE.PointLight;
  private tmpCol = new THREE.Color();

  constructor(private G: any) {
    this.glow = new Pool(G.scene, 750, true, glowTexture());
    this.smokeP = new Pool(G.scene, 500, false, smokeTexture());
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.tracerPos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(this.tracerCol, 3));
    this.tracers = new THREE.LineSegments(
      g,
      new THREE.LineBasicMaterial({
        vertexColors: true,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    this.tracers.frustumCulled = false;
    G.scene.add(this.tracers);
    this.flash = new THREE.PointLight(0xffa040, 0, 40, 1.6);
    G.scene.add(this.flash);
  }

  private r(a: number): number {
    return (Math.random() - 0.5) * a;
  }

  sparks(x: number, y: number, z: number, n: number): void {
    for (let i = 0; i < n; i++) {
      this.glow.emit({
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
        drag: 0.2,
      });
    }
  }

  nitroFlame(x: number, y: number, z: number, vx: number, vz: number): void {
    this.glow.emit({
      x: x + this.r(0.18),
      y: y + this.r(0.08),
      z: z + this.r(0.18),
      vx: vx + this.r(1.5),
      vy: 0.25 + Math.random() * 0.4,
      vz: vz + this.r(1.5),
      life: 0.2,
      s: 0.55,
      grow: -0.35,
      a: 0.95,
      c0: [0.5, 3.8, 5.2],
      c1: [3.2, 1.1, 0.2],
      drag: 0.5,
    });
  }

  muzzle(x: number, y: number, z: number): void {
    this.glow.emit({
      x,
      y,
      z,
      life: 0.06,
      s: 0.52,
      a: 1,
      c0: [6, 4, 1.8],
    });
    this.flash.position.set(x, y, z);
    this.flash.intensity = Math.max(this.flash.intensity, 25);
  }

  blood(x: number, y: number, z: number): void {
    for (let i = 0; i < 6; i++) {
      this.smokeP.emit({
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
        c0: [0.5, 0.02, 0.02],
      });
    }
  }

  smoke(x: number, y: number, z: number, black: boolean | number): void {
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
      c1: black ? [0.15, 0.15, 0.15] : [0.9, 0.9, 0.9],
    });
  }

  tyreSmoke(x: number, z: number): void {
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
      c0: [0.92, 0.9, 0.88],
    });
  }

  fire(x: number, y: number, z: number): void {
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
      c1: [1.6, 0.2, 0.05],
    });
    if (Math.random() < 0.4) this.smoke(x, y + 2, z, true);
  }

  explosion(x: number, y: number, z: number): void {
    for (let i = 0; i < 64; i++) {
      this.glow.emit({
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
        c1: [1.5, 0.2, 0.05],
      });
    }
    for (let i = 0; i < 24; i++) {
      this.smoke(x + this.r(3), y + Math.random() * 3, z + this.r(3), true);
    }
    this.sparks(x, y, z, 26);
    this.flash.position.set(x, y + 2, z);
    this.flash.intensity = 400;
    const P = this.G.player;
    const dist = Math.hypot(P.x - x, P.z - z);
    if (dist < 42) this.G.cam.addShake(1 - dist / 42);
  }

  tracer(
    ax: number,
    ay: number,
    az: number,
    bx: number,
    by: number,
    bz: number,
    color: number,
  ): void {
    const i = this.ti;
    this.ti = (this.ti + 1) % 64;
    const len = Math.hypot(bx - ax, by - ay, bz - az) || 1;
    const cut = Math.min(1, 6 / len);
    const t0 = Math.random() * (1 - cut);
    const off = i * 6;
    this.tracerPos[off] = ax + (bx - ax) * t0;
    this.tracerPos[off + 1] = ay + (by - ay) * t0;
    this.tracerPos[off + 2] = az + (bz - az) * t0;
    this.tracerPos[off + 3] = ax + (bx - ax) * (t0 + cut);
    this.tracerPos[off + 4] = ay + (by - ay) * (t0 + cut);
    this.tracerPos[off + 5] = az + (bz - az) * (t0 + cut);
    this.tmpCol.setHex(color).multiplyScalar(4);
    this.tracerCol[off] = this.tmpCol.r;
    this.tracerCol[off + 1] = this.tmpCol.g;
    this.tracerCol[off + 2] = this.tmpCol.b;
    this.tracerCol[off + 3] = this.tmpCol.r;
    this.tracerCol[off + 4] = this.tmpCol.g;
    this.tracerCol[off + 5] = this.tmpCol.b;
    this.tracerLife[i] = 0.07;
  }

  update(dt: number): void {
    this.glow.update(dt);
    this.smokeP.update(dt);
    for (let i = 0; i < 64; i++) {
      if (this.tracerLife[i] > 0) {
        this.tracerLife[i] -= dt;
        if (this.tracerLife[i] <= 0) {
          this.tracerCol.fill(0, i * 6, i * 6 + 6);
        }
      }
    }
    this.tracers.geometry.attributes.position.needsUpdate = true;
    this.tracers.geometry.attributes.color.needsUpdate = true;
    this.flash.intensity *= Math.pow(0.002, dt);
  }
}
