// HelicopterUnit: PCPD Air-1 overhead pursuit helicopter (3★+ spotlight, 4★+ suppression fire).
import * as THREE from 'three';
import { damp } from '../core/MathUtil.ts';
import { MeshKit, rgb } from '../render/MeshKit.ts';
import { glowTexture } from '../render/Textures.ts';

export class HelicopterUnit {
  public x = 0;
  public y = 32;
  public z = 0;
  public active = false;
  public angle = 0;
  public group: THREE.Group;
  private rotor: THREE.Mesh;
  private beam: THREE.Mesh;
  private pool: THREE.Mesh;
  private fireCd = 2;

  constructor(private G: any) {
    const g = new THREE.Group();
    const k = new MeshKit();
    const body = rgb('#162647');
    const stripe = rgb('#e8b43a');
    const dark = rgb('#14171c');
    const glass = rgb('#10263a');

    k.box(0, 0, -0.4, 1.9, 1.45, 3.6, body);
    k.box(0, -0.1, -2.5, 1.5, 1.0, 1.4, glass);
    k.box(0, 0.25, -0.4, 1.96, 0.16, 3.4, stripe);
    k.box(0, 0.15, 3.6, 0.55, 0.55, 4.8, body);
    k.box(0, 0.75, 5.8, 0.2, 1.3, 0.7, body);
    k.box(0, 0.75, 5.8, 0.25, 0.25, 0.7, stripe);
    for (const s of [-1, 1]) {
      k.box(s * 1.15, -1.05, -0.4, 0.14, 0.12, 3.6, dark);
      k.box(s * 0.9, -0.75, -1.2, 0.12, 0.55, 0.12, dark);
      k.box(s * 0.9, -0.75, 0.6, 0.12, 0.55, 0.12, dark);
    }
    const hull = new THREE.Mesh(
      k.geometry(),
      new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.4, metalness: 0.4 }),
    );
    hull.castShadow = !G.isSoftwareGl;
    g.add(hull);

    const rotorGeo = new THREE.CylinderGeometry(4.6, 4.6, 0.08, 24);
    const rotorMat = new THREE.MeshBasicMaterial({
      color: 0x1e222b,
      transparent: true,
      opacity: 0.48,
    });
    this.rotor = new THREE.Mesh(rotorGeo, rotorMat);
    this.rotor.position.set(0, 1.12, -0.2);
    g.add(this.rotor);

    const beamGeo = new THREE.ConeGeometry(7.2, 36, 16, 1, true);
    beamGeo.translate(0, -18, 0);
    const beamMat = new THREE.MeshBasicMaterial({
      color: 0xfff0c8,
      transparent: true,
      opacity: 0.13,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
    });
    this.beam = new THREE.Mesh(beamGeo, beamMat);
    this.beam.position.set(0, -0.7, -2.0);
    g.add(this.beam);

    this.pool = new THREE.Mesh(
      new THREE.PlaneGeometry(13, 13),
      new THREE.MeshBasicMaterial({
        map: glowTexture(),
        color: 0xfff2cc,
        transparent: true,
        opacity: 0.55,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    this.pool.rotation.x = -Math.PI / 2;
    this.pool.position.y = 0.07;

    g.visible = false;
    this.pool.visible = false;
    G.scene.add(g);
    G.scene.add(this.pool);
    this.group = g;
  }

  setActive(on: boolean): void {
    if (on === this.active) return;
    this.active = on;
    this.group.visible = on;
    this.pool.visible = on;
    if (on) {
      const P = this.G.player;
      this.x = P.x + 120;
      this.z = P.z - 120;
      this.y = 32;
    }
  }

  update(dt: number, level: number): void {
    this.setActive(level >= 3);
    if (!this.active) return;
    const G = this.G;
    const P = G.player;
    this.angle += dt * 0.46;
    const tx = P.x + Math.cos(this.angle) * 28;
    const tz = P.z + Math.sin(this.angle) * 28;
    this.x = damp(this.x, tx, 1.35, dt);
    this.z = damp(this.z, tz, 1.35, dt);
    this.y = 29 + Math.sin(this.angle * 2) * 2.2;

    this.group.position.set(this.x, this.y, this.z);
    const lookYaw = Math.atan2(this.x - P.x, this.z - P.z);
    this.group.rotation.y = lookYaw;
    this.group.rotation.x = 0.16;
    this.rotor.rotation.y += dt * 26;

    const dx = P.x - this.x;
    const dz = P.z - this.z;
    const horiz = Math.hypot(dx, dz);
    this.beam.rotation.x = Math.atan2(horiz, this.y) * 0.65;
    this.pool.position.set(P.x, 0.07, P.z);

    if (level >= 4 && horiz < 48 && !P.dead) {
      this.fireCd -= dt;
      if (this.fireCd <= 0) {
        this.fireCd = level >= 5 ? 0.52 : 0.95;
        G.combat.npcShoot(
          { x: this.x, y: this.y - 1.2, z: this.z, heading: lookYaw },
          P,
          level >= 5 ? 0.24 : 0.16,
          6,
        );
      }
    }
  }

  dispose(): void {
    this.G.scene.remove(this.group);
    this.G.scene.remove(this.pool);
  }
}
