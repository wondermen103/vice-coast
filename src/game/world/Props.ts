// Props: photorealistic ringed coconut palms with alpha-cutout feathered fronds, strictly validated
// collision-free tree placement, sleek curved streetlights, sloped pier approach ramp,
// Vice Lighthouse Pier, port cranes, English billboards, stunt ramps, and rich coastal ocean shader.
import * as THREE from 'three';
import { MeshKit, rgb } from '../render/MeshKit.ts';
import {
  billboardTexture,
  createPalmBarkSet,
  createPalmFrondTex,
  createRampStripeTex,
  createWoodPlankSet,
  glowTexture,
} from '../render/Textures.ts';
import { Rng } from '../core/MathUtil.ts';
import {
  BLOCK,
  GRID,
  PIER_Z,
  ROAD,
  SEA_X,
  SIZE,
  STUNT_RAMPS,
  isValidTreeSpot,
  type StuntRampDef,
} from './CityLayout.ts';

const SEA_FRAG = `uniform vec3 sunDir; uniform vec3 sunColor; uniform vec3 deep; uniform vec3 shallow; uniform vec3 skyCol; uniform float time;
varying vec3 vW;
float w(vec2 p, vec2 d, float f, float s){ return sin(dot(p, d) * f + time * s); }
void main(){
  vec2 p = vW.xz;
  float wx = w(p, vec2(0.8, 0.6), 0.32, 1.2) * 0.08
           + w(p, vec2(-0.35, 0.94), 1.05, 2.0) * 0.045
           + w(p, vec2(0.65, -0.75), 2.5, 3.2) * 0.025
           + w(p, vec2(-0.82, -0.57), 4.8, 4.1) * 0.012;
  float wz = w(p, vec2(0.22, 0.98), 0.46, 1.6) * 0.08
           + w(p, vec2(0.91, -0.24), 1.65, 2.5) * 0.04
           + w(p, vec2(-0.55, 0.83), 3.7, 3.5) * 0.018;
  vec3 n = normalize(vec3(wx, 1.0, wz));
  vec3 v = normalize(cameraPosition - vW);
  float fres = pow(1.0 - max(dot(n, v), 0.0), 4.2);
  float shore = smoothstep(-94.0, -63.0, vW.x);
  vec3 c = mix(deep, shallow, shore * 0.84);
  c = mix(c, skyCol, 0.24 + fres * 0.64);
  vec3 h = normalize(sunDir + v);
  c += sunColor * pow(max(dot(n, h), 0.0), 260.0) * 16.0;
  c += sunColor * pow(max(dot(n, h), 0.0), 34.0) * 0.42;
  float waveBand = sin(vW.x * 0.88 + time * 1.65 + sin(vW.z * 0.19) * 2.2);
  float foam = smoothstep(0.55, 0.98, waveBand) * smoothstep(-76.0, -64.0, vW.x);
  c = mix(c, vec3(0.96, 0.99, 1.0), foam * 0.65);
  gl_FragColor = vec4(c, 1.0);
  #include <fog_fragment>
}`;

const ADS = [
  ['VICE COLA', 'taste the sunset', '#ff2e93', '#ff8c42'],
  ['WAVE 104.5 FM', 'synthwave all night', '#4323b8', '#ff2e93'],
  ['APEX MOTORS', 'the new Solaris V12', '#0b68c4', '#00f0d8'],
  ['COASTLINE AIR', 'fly the vice coast', '#e85d35', '#ffd23f'],
  ['VICE NATIONAL', 'your cash, your coast', '#0b6e66', '#00f0d8'],
];

// Dedicated geometry builder for curved alpha-cutout feathered palm fronds
class FrondKit {
  public pos: number[] = [];
  public nor: number[] = [];
  public col: number[] = [];
  public uvs: number[] = [];
  public idx: number[] = [];

  addBlade(
    cx: number,
    cy: number,
    cz: number,
    angle: number,
    length: number,
    width: number,
    lift: number,
    droop: number,
    tint: [number, number, number],
  ): void {
    const segs = 4;
    const dirX = Math.cos(angle);
    const dirZ = Math.sin(angle);
    const sideX = -dirZ;
    const sideZ = dirX;
    const baseIdx = this.pos.length / 3;

    for (let i = 0; i <= segs; i++) {
      const t = i / segs;
      const dist = t * length;
      // Natural graceful tropical arch: rises near crownshaft, then cascades gracefully outward
      const yOff = lift * Math.sin(t * Math.PI * 0.65) - droop * t * t * 1.45;
      // Subtle V-fold along frond width for 3D leaf depth
      const hw = width * 0.5;
      const vFold = -0.14 * hw;

      const midX = cx + dirX * dist;
      const midY = cy + yOff;
      const midZ = cz + dirZ * dist;

      // Normal tilted upward along arch
      const ny = 0.88;
      const nx = -dirX * 0.25;
      const nz = -dirZ * 0.25;

      // Left, center spine, right vertices per ring
      const pts = [
        [midX - sideX * hw, midY + vFold, midZ - sideZ * hw, 0, t],
        [midX, midY + 0.04, midZ, 0.5, t],
        [midX + sideX * hw, midY + vFold, midZ + sideZ * hw, 1, t],
      ];
      for (const p of pts) {
        this.pos.push(p[0], p[1], p[2]);
        this.nor.push(nx, ny, nz);
        this.col.push(tint[0], tint[1], tint[2]);
        this.uvs.push(p[3], p[4]);
      }
    }

    for (let i = 0; i < segs; i++) {
      const r0 = baseIdx + i * 3;
      const r1 = r0 + 3;
      // Left strip
      this.idx.push(r0, r1, r1 + 1, r0, r1 + 1, r0 + 1);
      // Right strip
      this.idx.push(r0 + 1, r1 + 1, r1 + 2, r0 + 1, r1 + 2, r0 + 2);
    }
  }

  geometry(): THREE.BufferGeometry {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uvs, 2));
    g.setIndex(this.idx);
    g.computeBoundingSphere();
    return g;
  }
}

export class Props {
  private rng = new Rng(4242);
  private palmTrunks = new MeshKit();
  private palmFronds = new FrondKit();
  private misc = new MeshKit();
  private woodPier = new MeshKit();
  private lamps: THREE.Sprite[] = [];
  private rampBeacons: THREE.Sprite[] = [];
  private placedTrees: Array<[number, number]> = [];
  private beachProps: Array<[number, number]> = [];
  private beam!: THREE.Mesh;
  private beamPivot!: THREE.Group;
  private seaUniforms!: Record<string, THREE.IUniform>;
  private city: any;

  constructor(private G: any) {}

  private canPlaceTree(x: number, z: number, minSpacing = 6.5): boolean {
    if (!isValidTreeSpot(x, z)) return false;
    // Keep clear of Bayview Safehouse spawn & Lou's Pier Lounge entrance
    if (Math.hypot(x - 10, z - (3 * BLOCK + 24)) < 12.5) return false;
    if (Math.hypot(x - 16, z - (PIER_Z + 12)) < 9.5) return false;
    // Never overlap solid buildings or props already registered in collision
    if (this.G.collision?.blocked?.(x, z, 1.8)) return false;
    // Maintain clean spacing from other trees
    for (const [tx, tz] of this.placedTrees) {
      if (Math.hypot(x - tx, z - tz) < minSpacing) return false;
    }
    // Keep clear of beach umbrellas & lifeguard towers
    for (const [bx, bz] of this.beachProps) {
      if (Math.hypot(x - bx, z - bz) < 4.5) return false;
    }
    return true;
  }

  build(city: any): this {
    const G = this.G;
    const r = this.rng;
    this.city = city;
    const aniso = G.renderer.capabilities.getMaxAnisotropy();

    // Build pier, cranes, and beach props FIRST so trees validate against them cleanly
    this.pier();
    this.cranes();

    // Lifeguard towers on Sunset Beach (keep clear of pier & beach stunt ramp)
    for (const z of [48, 140, 325, 455, 548]) {
      this.lifeguard(-48, z);
      this.beachProps.push([-48, z]);
    }

    // Beach umbrellas & loungers (validated against pier, stunt ramp corridor, and lifeguard towers)
    const umb = ['#ff2e93', '#00d9cc', '#ffd23f', '#ff7c5c', '#7c6bff'];
    for (let i = 0; i < 64; i++) {
      const x = r.range(-54, -24);
      const z = r.range(-25, SIZE + 25);
      if (Math.abs(z - PIER_Z) < 13) continue;
      // Clear full approach & landing corridor around Boardwalk Hopper ramp (-34, 185)
      if (Math.abs(x - -34) < 13 && Math.abs(z - 185) < 28) continue;
      if (this.beachProps.some(([bx, bz]) => Math.hypot(x - bx, z - bz) < 5.5)) continue;
      this.umbrella(x, z, rgb(r.pick(umb)));
      this.beachProps.push([x, z]);
    }

    // 1. Ocean Drive Promenade Palms (neat coral-stone planter bays, strictly clear of Pier & stairs)
    for (let z = -24; z <= SIZE + 24; z += 16) {
      const px = -ROAD / 2 - 2.6;
      const pz = z;
      if (
        Math.abs(pz - 108) < 5 ||
        Math.abs(pz - 396) < 5 ||
        Math.abs(pz - 540) < 5
      ) {
        continue;
      }
      if (this.canPlaceTree(px, pz, 8)) {
        // Raised stone planter rim on the promenade
        this.misc.box(px, 0.36, pz, 2.2, 0.32, 2.2, rgb('#efe6d8'));
        this.misc.box(px, 0.5, pz, 1.8, 0.08, 1.8, rgb('#4e3c2c'));
        this.palm(px, pz, r.range(8.5, 11.5), true);
      }
    }

    // 2. Sunset Beach Upper Dune Palms (organic clusters well clear of ramps, pier & umbrellas)
    for (let z = -20; z <= SIZE + 20; z += 22) {
      const bx = -ROAD / 2 - 12.5 - r.range(0, 7);
      const bz = z + r.range(-4, 4);
      if (this.canPlaceTree(bx, bz, 8.5)) {
        this.palm(bx, bz, r.range(7.5, 12.5), false);
      }
    }
    for (let i = 0; i < 24; i++) {
      const bx = -ROAD / 2 - 20 - r.range(0, 22);
      const bz = r.range(-30, SIZE + 30);
      if (this.canPlaceTree(bx, bz, 9.5)) {
        this.palm(bx, bz, r.range(6.8, 11.2), false);
      }
    }

    // 3. City Park Palms (inside park quadrants, clear of stone paths & central fountain)
    for (const lot of city.parks) {
      const cx = (lot.x0 + lot.x1) / 2;
      const cz = (lot.z0 + lot.z1) / 2;
      for (const sx of [-1, 1]) {
        for (const sz of [-1, 1]) {
          for (const [ox, oz] of [
            [9, 9],
            [18, 10],
            [10, 18],
          ]) {
            const px = cx + sx * ox;
            const pz = cz + sz * oz;
            if (this.canPlaceTree(px, pz, 6.5)) {
              this.palm(px, pz, r.range(8, 12), false);
            }
          }
        }
      }
    }

    // 4. Boulevard Mid-Block Sidewalk Palms (STRICTLY mid-block — never inside intersections or crosswalks!)
    for (let kx = 0; kx <= 4; kx++) {
      for (let bz = 0; bz < GRID; bz++) {
        // Two symmetric mid-block tree positions per 72m block: at +22m and +50m
        for (const offset of [22, 50]) {
          const pz = bz * BLOCK + offset;
          // East sidewalk of Ocean Drive (kx=0) and both sidewalks of Coral & Breeze Avenues
          const sides = kx === 0 ? [1] : kx <= 2 ? [-1, 1] : [1];
          for (const side of sides) {
            const px = kx * BLOCK + side * (ROAD / 2 + 2.0);
            if (this.canPlaceTree(px, pz, 7.5)) {
              // Sleek flush coral-stone tree well collar with dark mulch interior
              this.misc.box(px, 0.24, pz, 1.85, 0.08, 1.85, rgb('#e4dcd0'));
              this.misc.box(px, 0.27, pz, 1.48, 0.05, 1.48, rgb('#443628'));
              this.palm(px, pz, r.range(8.2, 11.2), true);
            }
          }
        }
      }
    }

    // 5. Palm Heights Residential Street Trees (strictly mid-block on north/south grass verges)
    for (let bx = 0; bx < 6; bx++) {
      for (let bz = 0; bz < 2; bz++) {
        for (const ox of [20, 52]) {
          const px = bx * BLOCK + ox;
          const pz = bz * BLOCK + ROAD / 2 + 2.0;
          if (this.canPlaceTree(px, pz, 7.5)) {
            this.palm(px, pz, r.range(7.5, 10.5), false);
          }
        }
      }
    }

    // Street lamps (mid-block along avenues, SKIPPING the Vice Lighthouse Pier opening)
    for (let kx = 0; kx <= GRID; kx++) {
      for (let kz = 0; kz < GRID; kz++) {
        const lz = kz * BLOCK + BLOCK / 2;
        for (const s of [-1, 1]) {
          const lx = kx * BLOCK + s * (ROAD / 2 + 0.9);
          // Fix bug: do not place a street lamp inside the pier approach at kx=0, s=-1, z=PIER_Z
          if (kx === 0 && s === -1 && Math.abs(lz - PIER_Z) < 10) continue;
          this.lamp(lx, lz, -s, 0);
        }
      }
    }

    this.billboards(city);
    this.buildStuntRamps(aniso);

    // Photorealistic Palm Trunks with Ringed Bark PBR Texture
    const barkTex = createPalmBarkSet(aniso);
    const trunkMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      vertexColors: true,
      map: barkTex.map,
      bumpMap: barkTex.bumpMap,
      bumpScale: 0.09,
      roughness: 0.88,
      metalness: 0.02,
    });
    const trunkMesh = new THREE.Mesh(this.palmTrunks.geometry(), trunkMat);
    trunkMesh.castShadow = !G.isSoftwareGl;
    trunkMesh.receiveShadow = !G.isSoftwareGl;
    G.scene.add(trunkMesh);

    // Photorealistic Alpha-Cutout Feathered Palm Fronds
    const frondTex = createPalmFrondTex(aniso);
    const frondMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      vertexColors: true,
      map: frondTex,
      alphaTest: 0.34,
      side: THREE.DoubleSide,
      roughness: 0.58,
      metalness: 0.04,
    });
    const frondMesh = new THREE.Mesh(this.palmFronds.geometry(), frondMat);
    frondMesh.castShadow = !G.isSoftwareGl;
    frondMesh.receiveShadow = !G.isSoftwareGl;
    G.scene.add(frondMesh);

    const mm = new THREE.Mesh(
      this.misc.geometry(),
      new THREE.MeshStandardMaterial({
        vertexColors: true,
        roughness: 0.52,
        metalness: 0.2,
      }),
    );
    mm.castShadow = !G.isSoftwareGl;
    mm.receiveShadow = !G.isSoftwareGl;
    G.scene.add(mm);

    const woodTex = createWoodPlankSet(aniso);
    const wm = new THREE.Mesh(
      this.woodPier.geometry(),
      new THREE.MeshStandardMaterial({
        color: 0xffffff,
        vertexColors: true,
        map: woodTex.map,
        bumpMap: woodTex.bumpMap,
        bumpScale: 0.06,
        roughness: 0.84,
      }),
    );
    wm.castShadow = !G.isSoftwareGl;
    wm.receiveShadow = !G.isSoftwareGl;
    G.scene.add(wm);

    this.sea();
    return this;
  }

  private buildStuntRamps(aniso: number): void {
    const deckTex = createRampStripeTex(aniso);
    const deckMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: deckTex,
      roughness: 0.42,
      metalness: 0.25,
    });
    const steelMat = new THREE.MeshStandardMaterial({
      color: '#202636',
      roughness: 0.52,
      metalness: 0.48,
    });
    const glowMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(0.15, 2.3, 2.15),
      fog: false,
    });

    for (const r of STUNT_RAMPS) {
      this.buildSingleRamp(r, deckMat, steelMat, glowMat);
    }
  }

  private buildSingleRamp(
    r: StuntRampDef,
    deckMat: THREE.Material,
    steelMat: THREE.Material,
    glowMat: THREE.Material,
  ): void {
    const grp = new THREE.Group();
    grp.position.set(r.x, 0, r.z);
    grp.rotation.y = r.heading;

    const slopeLen = Math.hypot(r.length, r.height);
    const slopeAng = Math.atan2(r.height, r.length);

    const deck = new THREE.Mesh(new THREE.BoxGeometry(r.width, 0.22, slopeLen), deckMat);
    deck.position.set(0, r.height * 0.5, 0);
    deck.rotation.x = slopeAng;
    deck.castShadow = !this.G.isSoftwareGl;
    deck.receiveShadow = !this.G.isSoftwareGl;
    grp.add(deck);

    for (const s of [-1, 1]) {
      const post = new THREE.Mesh(
        new THREE.BoxGeometry(0.26, r.height, 0.38),
        steelMat,
      );
      post.position.set(s * (r.width / 2 - 0.14), r.height / 2, -r.length / 2 + 0.25);
      grp.add(post);

      const midPost = new THREE.Mesh(
        new THREE.BoxGeometry(0.24, r.height * 0.55, 0.3),
        steelMat,
      );
      midPost.position.set(s * (r.width / 2 - 0.14), r.height * 0.275, 0);
      grp.add(midPost);

      const rail = new THREE.Mesh(
        new THREE.BoxGeometry(0.14, 0.14, slopeLen),
        glowMat,
      );
      rail.position.set(s * (r.width / 2 + 0.04), r.height * 0.5 + 0.14, 0);
      rail.rotation.x = slopeAng;
      grp.add(rail);
    }

    const sp = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: glowTexture(),
        color: 0x00f0d8,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    sp.position.set(0, r.height + 1.4, -r.length / 2);
    sp.scale.setScalar(3.4);
    grp.add(sp);
    this.rampBeacons.push(sp);

    this.G.scene.add(grp);
  }

  // Photorealistic Curved Coconut Palm (cylindrical ringed trunk + coconuts + arched feathered fronds)
  private palm(x: number, z: number, h: number, upright: boolean): void {
    this.placedTrees.push([x, z]);
    const k = this.palmTrunks;
    const r = this.rng;
    const leanMag = upright ? 0.18 : 0.48;
    const leanX = r.range(-leanMag, leanMag);
    const leanZ = r.range(-leanMag, leanMag);
    const segs = 7;

    let px = x;
    let py = 0.12;
    let pz = z;
    const baseTint = rgb(r.pick(['#dcd3c8', '#d4c6b8', '#e2d7ca']));

    // Flared root collar at base
    k.cyl(x, 0.34, z, 0.32, 0.44, 0.5, 9, baseTint, { uvScale: 0.45 });

    const mat = new THREE.Matrix4();
    const quat = new THREE.Quaternion();
    const up = new THREE.Vector3(0, 1, 0);
    const dir = new THREE.Vector3();

    for (let i = 0; i < segs; i++) {
      const t0 = i / segs;
      const t1 = (i + 1) / segs;
      const y0 = t0 * h;
      const y1 = t1 * h;
      const x0 = x + leanX * Math.pow(t0, 1.85) * 3.1;
      const z0 = z + leanZ * Math.pow(t0, 1.85) * 3.1;
      const x1 = x + leanX * Math.pow(t1, 1.85) * 3.1;
      const z1 = z + leanZ * Math.pow(t1, 1.85) * 3.1;

      dir.set(x1 - x0, y1 - y0, z1 - z0);
      const segLen = dir.length();
      quat.setFromUnitVectors(up, dir.clone().normalize());
      mat.makeRotationFromQuaternion(quat);

      const rb = 0.31 - t0 * 0.13;
      const rt = 0.31 - t1 * 0.13;
      k.cyl((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2, rt, rb, segLen * 1.06, 9, baseTint, {
        m: mat,
        open: true,
        uvScale: 0.5,
      });

      px = x1;
      py = y1;
      pz = z1;
    }

    // Green fibrous crownshaft + cluster of tropical coconuts
    k.cyl(px, py + 0.15, pz, 0.22, 0.19, 0.65, 8, rgb('#5d7434'), { uvScale: 0.6 });
    const cocoCol = rgb('#5b3a1e');
    for (let c = 0; c < 4; c++) {
      const ca = (c / 4) * Math.PI * 2 + r.range(-0.2, 0.2);
      k.cyl(
        px + Math.cos(ca) * 0.26,
        py - 0.18,
        pz + Math.sin(ca) * 0.26,
        0.13,
        0.16,
        0.26,
        7,
        cocoCol,
      );
    }

    // 11 Lush Arched Feathered Fronds (upper sunlit crown + lower cascading canopy)
    const frondTints: Array<[number, number, number]> = [
      rgb('#eaf8d8'),
      rgb('#d2f0c0'),
      rgb('#bfe6b0'),
      rgb('#f0fad8'),
    ];
    const frondCount = 11;
    for (let i = 0; i < frondCount; i++) {
      const a = (i / frondCount) * Math.PI * 2 + r.range(-0.18, 0.18);
      const upper = i % 3 === 0;
      const len = upper ? r.range(3.6, 4.4) : r.range(4.4, 5.5);
      const wid = upper ? r.range(1.6, 2.0) : r.range(1.9, 2.4);
      const lift = upper ? r.range(1.4, 2.0) : r.range(0.6, 1.15);
      const droop = upper ? r.range(0.6, 1.0) : r.range(1.25, 1.85);
      this.palmFronds.addBlade(
        px,
        py + (upper ? 0.36 : 0.16),
        pz,
        a,
        len,
        wid,
        lift,
        droop,
        frondTints[i % frondTints.length],
      );
    }

    this.G.collision.addCircle(x, z, 0.36, 6);
  }

  // Sleek coastal tapered metallic street lamp
  private lamp(x: number, z: number, dx: number, dz: number): void {
    const k = this.misc;
    const pole = rgb('#4a5464');
    // Cast base pedestal
    k.cyl(x, 0.35, z, 0.18, 0.26, 0.7, 8, rgb('#363d4a'));
    // Tapered pole
    k.cyl(x, 3.8, z, 0.08, 0.14, 7.0, 8, pole);
    // Curved upper arm
    k.box(
      x + dx * 0.95,
      7.18,
      z + dz * 0.95,
      2.1 * Math.abs(dx) + 0.12,
      0.11,
      2.1 * Math.abs(dz) + 0.12,
      pole,
    );
    // Modern cobra-head luminaire housing + warm glowing lens
    k.box(x + dx * 1.95, 7.12, z + dz * 1.95, 0.68, 0.14, 0.36, rgb('#2c3340'));
    k.box(x + dx * 1.95, 7.02, z + dz * 1.95, 0.56, 0.08, 0.28, rgb('#fff2cc', 3.2));
    const s = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: glowTexture(),
        color: 0xffd088,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        fog: false,
      }),
    );
    s.position.set(x + dx * 1.95, 6.85, z + dz * 1.95);
    s.scale.setScalar(3.3);
    this.G.scene.add(s);
    this.lamps.push(s);
    this.G.collision.addCircle(x, z, 0.22, 7);
  }

  private umbrella(x: number, z: number, col: [number, number, number]): void {
    const k = this.misc;
    k.cyl(x, 1.25, z, 0.04, 0.045, 2.5, 6, rgb('#ded6ca'));
    k.cyl(x, 2.48, z, 0.08, 1.65, 0.45, 12, col);
    k.cyl(x, 2.28, z, 1.65, 1.68, 0.1, 12, rgb('#ffffff'));
    // Wooden beach lounger with crisp white cushion
    k.box(x + 1.25, 0.22, z + 0.3, 0.85, 0.14, 1.95, rgb('#9c734b'));
    k.box(x + 1.25, 0.32, z + 0.3, 0.76, 0.1, 1.85, rgb('#faf8f2'));
  }

  private lifeguard(x: number, z: number): void {
    const k = this.misc;
    for (const [a, b] of [
      [-1, -1],
      [1, -1],
      [-1, 1],
      [1, 1],
    ]) {
      k.box(x + a, 1.5, z + b, 0.2, 3, 0.2, rgb('#f4f2ee'));
    }
    k.box(x, 3.6, z, 3, 2, 3, rgb('#ff5c9e'));
    k.box(x, 4.9, z, 3.6, 0.5, 3.6, rgb('#00d4c8'), { tx: 0.6, tz: 0.6 });
    k.box(x + 1.6, 3.8, z, 0.1, 1, 2, rgb('#fff6c0', 1.2));
  }

  private pier(): void {
    const k = this.misc;
    const len = 142;
    const xStart = -ROAD / 2 - 16; // Pier flat deck begins at x = -24
    const xProm = -ROAD / 2 - 6.2; // Promenade edge at x = -14.2
    const z = PIER_Z;

    // Sloped timber approach ramp smoothly connecting Ocean Drive promenade (y=0.26) to Pier deck (y=2.4)
    const rampRun = xProm - xStart; // ~9.8m
    const rampRise = 2.4 - 0.26;
    const rampLen = Math.hypot(rampRun, rampRise);
    const rampAng = Math.atan2(rampRise, rampRun);
    const rampCx = (xProm + xStart) / 2;
    const rampCy = (2.4 + 0.26) / 2 - 0.18;
    const rampDeckMat = new THREE.Matrix4()
      .makeTranslation(rampCx, rampCy, z)
      .multiply(new THREE.Matrix4().makeRotationZ(-rampAng));
    this.woodPier.box(0, 0, 0, rampLen, 0.42, 8.8, rgb('#ffffff'), {
      m: rampDeckMat,
      uvScale: 0.26,
    });
    // Sloped ramp side guardrails
    for (const s of [-4.1, 4.1]) {
      const railMat = new THREE.Matrix4()
        .makeTranslation(rampCx, (2.4 + 0.26) / 2 + 1.05, z + s)
        .multiply(new THREE.Matrix4().makeRotationZ(-rampAng));
      k.box(0, 0, 0, rampLen, 0.12, 0.12, rgb('#f4f4f4'), { m: railMat });
      k.box(xProm - 1.5, 0.85, z + s, 0.15, 1.3, 0.15, rgb('#f4f4f4'));
      k.box(rampCx, 1.75, z + s, 0.15, 1.3, 0.15, rgb('#f4f4f4'));
    }

    // Textured timber planks main pier deck
    this.woodPier.box(xStart - len / 2, 2.4, z, len, 0.5, 9, rgb('#ffffff'), {
      uvScale: 0.26,
    });
    for (let x = xStart - 2; x > xStart - len; x -= 6) {
      for (const s of [-4, 4]) {
        k.cyl(x, 0.6, z + s, 0.28, 0.3, 4.2, 8, rgb('#5a422d'));
        k.box(x, 3.3, z + s * 1.02, 0.15, 1.2, 0.15, rgb('#f2f2f2'));
      }
    }
    k.box(xStart - len / 2, 3.9, z - 4.1, len, 0.12, 0.12, rgb('#f2f2f2'));
    k.box(xStart - len / 2, 3.9, z + 4.1, len, 0.12, 0.12, rgb('#f2f2f2'));

    // Vice Coast Lighthouse
    const lx = xStart - len + 4;
    for (let i = 0; i < 6; i++) {
      k.cyl(
        lx,
        3 + i * 2.5 + 1.25,
        z,
        2.2 - (i + 1) * 0.18,
        2.2 - i * 0.18,
        2.5,
        14,
        rgb(i % 2 ? '#f6f2ea' : '#e03c52'),
      );
    }
    k.cyl(lx, 19.2, z, 1.3, 1.3, 2.4, 12, rgb('#ffe9a8', 4));
    k.cyl(lx, 21, z, 0.1, 1.8, 1.4, 12, rgb('#222e3e'));
    this.beam = new THREE.Mesh(
      new THREE.ConeGeometry(5, 90, 16, 1, true),
      new THREE.MeshBasicMaterial({
        color: 0xffe7a0,
        transparent: true,
        opacity: 0.18,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
        fog: false,
      }),
    );
    this.beam.geometry.translate(0, -45, 0);
    this.beam.geometry.rotateZ(Math.PI / 2);
    this.beamPivot = new THREE.Group();
    this.beamPivot.position.set(lx, 19.2, z);
    this.beamPivot.add(this.beam);
    this.G.scene.add(this.beamPivot);

    // Grand entrance archway at pier deck start
    k.box(xStart - 1, 5.2, z - 4.6, 0.6, 8.8, 0.6, rgb('#ffffff'));
    k.box(xStart - 1, 5.2, z + 4.6, 0.6, 8.8, 0.6, rgb('#ffffff'));
    this.city.sign('VICE LIGHTHOUSE PIER', '#00f0d8', xStart - 1, 8.8, z, 1, 0, 12.2);
  }

  private cranes(): void {
    const k = this.misc;
    for (const z of [100, 260, 420]) {
      const x = 7 * BLOCK + 40;
      const y = rgb('#f2a33a');
      for (const [a, b] of [
        [-3, -3],
        [3, -3],
        [-3, 3],
        [3, 3],
      ]) {
        k.box(x + a, 14, z + b, 0.7, 28, 0.7, y);
      }
      k.box(x, 28.5, z - 4, 4, 1.4, 46, y);
      k.box(x, 26.5, z + 1, 4, 3, 4, rgb('#3b4a5a'));
      k.box(x, 22, z - 20, 0.1, 13, 0.1, rgb('#222'));
      k.box(x, 15.5, z - 20, 2.4, 2.6, 6, rgb('#3d7f86'));
      this.G.collision.addBox(x - 3.4, z - 3.4, x + 3.4, z + 3.4, 28);
    }
  }

  private billboards(city: any): void {
    const tall = city.buildingTops.filter((b: any) => b.h > 16 && b.h < 40);
    for (let i = 0; i < 12 && i < tall.length; i++) {
      const b = tall[(i * 7) % tall.length];
      const ad = ADS[i % ADS.length];
      const m = new THREE.Mesh(
        new THREE.PlaneGeometry(14, 7),
        new THREE.MeshBasicMaterial({
          map: billboardTexture(ad[0], ad[1], ad[2], ad[3]),
          color: 0xd8d8d8,
        }),
      );
      m.position.set(b.x, b.h + 5.5, b.z);
      m.rotation.y = i % 2 ? Math.PI / 2 : -Math.PI / 2;
      this.G.scene.add(m);
      this.misc.box(b.x, b.h + 1, b.z, 0.4, 2, 0.4, rgb('#333'));
    }
  }

  private sea(): void {
    const sky = this.G.sky;
    this.seaUniforms = THREE.UniformsUtils.merge([
      THREE.UniformsLib.fog,
      {
        sunDir: { value: sky.sunDir },
        sunColor: { value: new THREE.Color() },
        deep: { value: new THREE.Color('#093c62') },
        shallow: { value: new THREE.Color('#19c6c4') },
        skyCol: { value: new THREE.Color() },
        time: { value: 0 },
      },
    ]);
    this.seaUniforms.sunDir.value = sky.sunDir;
    const mat = new THREE.ShaderMaterial({
      uniforms: this.seaUniforms,
      fog: true,
      fragmentShader: '#include <common>\n#include <fog_pars_fragment>\n' + SEA_FRAG,
      vertexShader:
        '#include <fog_pars_vertex>\nvarying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; vec4 mvPosition = viewMatrix * w; gl_Position = projectionMatrix * mvPosition;\n#include <fog_vertex>\n}',
    });
    const sea = new THREE.Mesh(new THREE.PlaneGeometry(1800, 2400), mat);
    sea.rotation.x = -Math.PI / 2;
    sea.position.set(SEA_X - 900 + 6, -0.25, SIZE / 2);
    this.G.scene.add(sea);
  }

  update(dt: number, sky: any): void {
    const u = this.seaUniforms;
    u.time.value += dt;
    u.sunColor.value.copy(sky.sun.color).multiplyScalar(1 - sky.night * 0.85);
    u.skyCol.value.copy(sky.uniforms.horizon.value);
    const n = sky.night;
    for (const s of this.lamps) {
      s.visible = n > 0.05 || sky.sunDir.y < 0.2 || sky.weather === 'storm';
      (s.material as THREE.SpriteMaterial).opacity = Math.min(1, 0.45 + n);
    }
    const pulse = 3.1 + Math.sin(u.time.value * 4) * 0.45;
    for (const b of this.rampBeacons) {
      b.scale.setScalar(pulse);
    }
    this.beamPivot.rotation.y += dt * 0.9;
    this.beam.visible = n > 0.1 || sky.sunDir.y < 0.15 || sky.weather === 'storm';
  }
}
