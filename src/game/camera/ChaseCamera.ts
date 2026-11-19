// ChaseCamera: smooth GTA VI-style chase/close/hood camera, damped over-the-shoulder aim framing,
// cinematic character-switch sky-swoop transition, Focus FOV tightening, nitrous FOV surge, and wall pull-in.
import * as THREE from 'three';
import { clamp, damp, wrapAngle } from '../core/MathUtil.ts';

export type CameraMode = 'chase' | 'close' | 'hood';
const MODES: readonly CameraMode[] = ['chase', 'close', 'hood'];

export class ChaseCamera {
  public yaw = 0;
  public pitch = 0.2;
  public mode: CameraMode = 'chase';
  private lookTimer = 0;
  public shake = 0;
  public snap = true;
  private switchT = 0;
  private curShoulder = 0.5;
  public pos = new THREE.Vector3();
  public look = new THREE.Vector3();
  private wantVec = new THREE.Vector3();
  private targetVec = new THREE.Vector3();
  private dirVec = new THREE.Vector3();

  constructor(private G: any) {}

  addShake(n: number): void {
    this.shake = Math.min(1.2, this.shake + n);
  }

  triggerSwitchSwoop(): void {
    this.switchT = 1.0;
  }

  cycleMode(): CameraMode {
    const idx = MODES.indexOf(this.mode);
    this.mode = MODES[(idx + 1) % MODES.length];
    return this.mode;
  }

  update(dt: number): void {
    const G = this.G;
    const P = G.player;
    const I = G.input;
    const cam = G.camera as THREE.PerspectiveCamera;

    const mdx = I.mouse.dx;
    const mdy = I.mouse.dy;
    this.yaw -= mdx * 0.0024;
    this.pitch = clamp(this.pitch + mdy * 0.0019, -0.2, 1.02);

    if (this.switchT > 0) {
      this.switchT = Math.max(0, this.switchT - dt * 3.8);
    }
    const swoopLift = Math.sin(this.switchT * Math.PI) * 6.5;

    let tx: number;
    let ty: number;
    let tz: number;
    let fov: number;

    if (P.vehicle) {
      const v = P.vehicle;
      const sp = Math.abs(v.speed);
      if (Math.abs(mdx) + Math.abs(mdy) > 0.5) this.lookTimer = 1.6;
      this.lookTimer -= dt;
      if (this.lookTimer <= 0 || this.mode === 'hood') {
        const behind = v.speed < -2 ? v.heading + Math.PI : v.heading;
        this.yaw += wrapAngle(behind - this.yaw) * (1 - Math.exp(-dt * (3.2 + sp * 0.065)));
        this.pitch = damp(this.pitch, this.mode === 'close' ? 0.14 : 0.19, 3.2, dt);
      }

      const boostFov = v.boosting ? 11 : 0;
      const focusFov = P.focusActive ? -6 : 0;
      fov = 59 + clamp(sp, 0, 58) * 0.34 + boostFov + focusFov;
      G.post.params.speedBlur = clamp((sp - 22) / 28 + (v.boosting ? 0.5 : 0), 0, 1);

      if (this.mode === 'hood') {
        this.wantVec.set(
          v.x + v.fx * 0.4,
          v.y + v.spec.h + 0.26,
          v.z + v.fz * 0.4,
        );
        this.targetVec.set(
          v.x + v.fx * 24,
          v.y + v.spec.h + 0.05,
          v.z + v.fz * 24,
        );
        if (this.snap) {
          this.pos.copy(this.wantVec);
          this.look.copy(this.targetVec);
          this.snap = false;
        }
        this.pos.lerp(this.wantVec, 1 - Math.exp(-dt * 24));
        this.look.lerp(this.targetVec, 1 - Math.exp(-dt * 24));
      } else {
        const distBase = this.mode === 'close' ? 5.0 : 7.0;
        const dist = distBase + v.spec.len * 0.34 + sp * 0.052;
        const height = (this.mode === 'close' ? 1.1 : 1.48) + v.spec.h * 0.52 + swoopLift;
        tx = v.x;
        ty = v.y + 1.2 + v.spec.h * 0.38;
        tz = v.z;
        this.computeOrbit(tx, ty, tz, dist, height, dt, 9.5);
      }
    } else {
      const aim = I.mouse.right || I.mouse.left;
      const dist = aim ? 2.95 : 4.25;
      const height = (aim ? 0.42 : 0.56) + swoopLift;
      fov = (aim ? 52 : 60) + (P.focusActive ? -5 : 0);
      this.curShoulder = damp(this.curShoulder, aim ? 0.92 : 0.48, 10, dt);
      const sx = Math.cos(this.yaw) * this.curShoulder;
      const sz = -Math.sin(this.yaw) * this.curShoulder;
      tx = P.x + sx;
      ty = 1.56;
      tz = P.z + sz;
      G.post.params.speedBlur = 0;
      this.computeOrbit(tx, ty, tz, dist, height, dt, 14);
    }

    cam.position.copy(this.pos);
    if (this.shake > 0) {
      this.shake = Math.max(0, this.shake - dt * 2.2);
      const s2 = this.shake * this.shake;
      cam.position.x += (Math.random() - 0.5) * s2 * 0.55;
      cam.position.y += (Math.random() - 0.5) * s2 * 0.4;
    }
    cam.lookAt(this.look);
    cam.fov = damp(cam.fov, fov, 5.5, dt);
    cam.updateProjectionMatrix();
  }

  private computeOrbit(
    tx: number,
    ty: number,
    tz: number,
    dist: number,
    height: number,
    dt: number,
    lambda: number,
  ): void {
    const cp = Math.cos(this.pitch);
    const ox = Math.sin(this.yaw) * cp * dist;
    const oz = Math.cos(this.yaw) * cp * dist;
    const oy = Math.sin(this.pitch) * dist + height;
    this.wantVec.set(tx + ox, ty + oy, tz + oz);
    this.targetVec.set(tx, ty, tz);

    this.dirVec.set(ox, 0, oz);
    const dl = this.dirVec.length();
    if (dl > 0.1) {
      this.dirVec.divideScalar(dl);
      const hit = this.G.collision.ray(
        tx,
        tz,
        this.dirVec.x,
        this.dirVec.z,
        dl,
        this.wantVec.y,
      );
      if (hit < dl) {
        this.wantVec.x = tx + this.dirVec.x * Math.max(0.8, hit - 0.6);
        this.wantVec.z = tz + this.dirVec.z * Math.max(0.8, hit - 0.6);
      }
    }

    if (this.snap) {
      this.pos.copy(this.wantVec);
      this.look.copy(this.targetVec);
      this.snap = false;
    }
    this.pos.lerp(this.wantVec, 1 - Math.exp(-dt * lambda));
    this.look.lerp(this.targetVec, 1 - Math.exp(-dt * 16));
  }

  forward(): [number, number] {
    return [-Math.sin(this.yaw), -Math.cos(this.yaw)];
  }
}
