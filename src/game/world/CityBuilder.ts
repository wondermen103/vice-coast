// CityBuilder: photorealistic Vice Coast coastal metropolis with fluted Art-Deco hotels,
// curtain-wall glass towers, terracotta-roofed Palm Heights villas, open pier promenade,
// street-facing hotel balconies, rooftop HVAC details, and dynamic wet-road reflections.
import * as THREE from 'three';
import { MeshKit, rgb } from '../render/MeshKit.ts';
import {
  createAsphaltSet,
  createCorrugatedSet,
  createCurtainGlassSet,
  createPromenadeSet,
  createSandSet,
  createStuccoSet,
  createTerracottaSet,
  neonTexture,
  type PBRTextureSet,
} from '../render/Textures.ts';
import { Rng, clamp, damp } from '../core/MathUtil.ts';
import {
  BLOCK,
  ROAD,
  GRID,
  SIZE,
  WALK,
  BEACH_W,
  PIER_Z,
  lots,
  type LotDef,
} from './CityLayout.ts';

const PASTEL = [
  '#f5a8bc',
  '#96e6d3',
  '#ffc89e',
  '#cfaef2',
  '#9cd2f7',
  '#f8e4b4',
  '#ffa18f',
  '#a2e8ed',
];
const TOWER = ['#3a7494', '#509cb2', '#2b5778', '#c4a26a', '#6388ad', '#7ebcc6'];
const NEONWALL = ['#351f4c', '#282f4e', '#462639', '#213a44', '#4d2b4d'];
const PORT = ['#b25538', '#397b82', '#c6973c', '#748592', '#994949'];
const HOTELS = [
  'HOTEL AURORA',
  'MOONLIGHT BAY',
  'BLUE TIDE',
  'FLAMINGO PALACE',
  'CORAL SUITES',
  'SUNSET PALMS',
  'BREEZE INN',
  'OCEANVIEW',
];
const CLUBS = [
  'CLUB MEDUSA',
  'THE PEARL',
  'PINK NIGHTS',
  'VOLTAGE',
  'NEON GRILL',
  'PINK PALMS',
  'MARINA DISCO',
  'ARCADE 88',
  'LUXE LOUNGE',
  'STARLIGHT',
];
const NEONCOL = ['#ff2e93', '#00f0d8', '#ffb02e', '#7dff6a', '#ff5b6e', '#b96bff'];

function windowMaterial(
  shared: Record<string, THREE.IUniform>,
  opts: { cw: number; ch: number; glass: number; tex: PBRTextureSet; bumpScale: number },
): THREE.MeshStandardMaterial {
  const m = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    vertexColors: true,
    map: opts.tex.map,
    bumpMap: opts.tex.bumpMap,
    bumpScale: opts.bumpScale,
    roughness: opts.glass > 0.5 ? 0.36 : 0.76,
    metalness: opts.glass > 0.5 ? 0.34 : 0.06,
  });

  m.onBeforeCompile = (s) => {
    Object.assign(s.uniforms, shared, {
      uCell: { value: new THREE.Vector2(opts.cw, opts.ch) },
      uGlass: { value: opts.glass },
    });
    s.vertexShader = s.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWPos; varying vec3 vWNorm;')
      .replace(
        '#include <worldpos_vertex>',
        '#include <worldpos_vertex>\nvWPos = (modelMatrix * vec4(transformed, 1.0)).xyz; vWNorm = normalize(mat3(modelMatrix) * objectNormal);',
      );
    s.fragmentShader = s.fragmentShader
      .replace(
        '#include <common>',
        '#include <common>\nvarying vec3 vWPos; varying vec3 vWNorm; uniform float uNight; uniform float uGlint; uniform vec3 uSunDir; uniform vec3 uSunCol; uniform vec2 uCell; uniform float uGlass;',
      )
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
      { vec3 n = normalize(vWNorm);
        if (abs(n.y) < 0.5) {
          float u = abs(n.x) > 0.5 ? vWPos.z : vWPos.x; float v = vWPos.y;
          vec2 cell = vec2(u / uCell.x, (v - 0.4) / uCell.y); vec2 f = fract(cell);
          float win = step(0.16, f.x) * step(f.x, 0.84) * step(0.28, f.y) * step(f.y, 0.9) * step(3.8, v);
          float sf = fract(u / 5.4);
          float shop = (1.0 - step(3.15, v)) * step(0.45, v) * step(0.12, sf) * step(sf, 0.88) * (1.0 - uGlass);
          float shopMullion = shop * (1.0 - step(0.47, sf) * step(sf, 0.53));
          float rnd = fract(sin(dot(floor(cell) + floor(vWPos.xz / 31.0) * 17.0, vec2(12.9898, 78.233))) * 43758.5453);
          float frame = (1.0 - step(0.1, f.x) * step(f.x, 0.9) * step(0.2, f.y) * step(f.y, 0.96)) * step(3.8, v) * (1.0 - uGlass);
          // Deep tinted architectural glass panes with sky reflection gradient
          vec3 glassTint = mix(vec3(0.03, 0.06, 0.11), vec3(0.12, 0.22, 0.34), clamp(f.y, 0.0, 1.0) * (1.0 - uNight * 0.72));
          vec3 shopGlass = mix(vec3(0.04, 0.07, 0.12), vec3(0.10, 0.16, 0.24), clamp((v - 0.45) / 2.7, 0.0, 1.0));
          diffuseColor.rgb = mix(diffuseColor.rgb, glassTint, win * 0.94);
          diffuseColor.rgb = mix(diffuseColor.rgb, shopGlass, shopMullion * 0.92);
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.18, 0.20, 0.26), (shop - shopMullion) * 0.85);
          diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * 1.18 + 0.05, frame * 0.42);
          roughnessFactor = mix(roughnessFactor, 0.12, max(win, shopMullion));
          metalnessFactor = mix(metalnessFactor, 0.62, win * (0.14 + uGlass * 0.78));
          vec3 warm = mix(vec3(1.0, 0.74, 0.44), vec3(0.32, 0.92, 1.0), step(0.78, rnd));
          totalEmissiveRadiance += win * step(0.50, rnd) * uNight * warm * 1.7 + shopMullion * warm * (0.08 + uNight * 0.68);
          float facing = max(dot(n, normalize(vec3(uSunDir.x, 0.0, uSunDir.z))), 0.0);
          totalEmissiveRadiance += win * uSunCol * pow(facing, 2.0) * uGlint * (0.28 + rnd * 0.85);
        } }`,
      );
  };
  return m;
}

export class CityBuilder {
  private rng = new Rng(1977);
  public shared: Record<string, THREE.IUniform>;
  private walls = new MeshKit();
  private towers = new MeshKit();
  private portWalls = new MeshKit();
  private tileRoofs = new MeshKit();
  private trim = new MeshKit();
  private glow = new MeshKit();
  private roads = new MeshKit();
  private roadMarks = new MeshKit();
  private sidewalks = new MeshKit();
  private beachSand = new MeshKit();
  public signs: THREE.Mesh[] = [];
  public parks: LotDef[] = [];
  public buildingTops: Array<{ x: number; z: number; w: number; d: number; h: number }> = [];
  private glowMat!: THREE.MeshBasicMaterial;
  private roadMat!: THREE.MeshStandardMaterial;

  constructor(private G: any) {
    this.shared = {
      uNight: { value: 0 },
      uGlint: { value: 0 },
      uSunDir: { value: new THREE.Vector3(0, 1, 0) },
      uSunCol: { value: new THREE.Color() },
    };
  }

  build(): this {
    const G = this.G;
    const aniso = G.renderer.capabilities.getMaxAnisotropy();

    const asphaltTex = createAsphaltSet(aniso);
    const promenadeTex = createPromenadeSet(aniso);
    const sandTex = createSandSet(aniso);
    const stuccoTex = createStuccoSet(aniso);
    const glassTex = createCurtainGlassSet(aniso);
    const portTex = createCorrugatedSet(aniso);
    const roofTex = createTerracottaSet(aniso);

    this.buildGround();
    for (const lot of lots()) this.buildLot(lot);

    const wallMat = windowMaterial(this.shared, {
      cw: 3.1,
      ch: 3.4,
      glass: 0,
      tex: stuccoTex,
      bumpScale: 0.06,
    });
    const towerMat = windowMaterial(this.shared, {
      cw: 2.2,
      ch: 3.6,
      glass: 1,
      tex: glassTex,
      bumpScale: 0.045,
    });
    const portMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      vertexColors: true,
      map: portTex.map,
      bumpMap: portTex.bumpMap,
      bumpScale: 0.09,
      roughness: 0.62,
      metalness: 0.22,
    });
    const roofMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      vertexColors: true,
      map: roofTex.map,
      bumpMap: roofTex.bumpMap,
      bumpScale: 0.08,
      roughness: 0.72,
      metalness: 0.04,
    });

    this.roadMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      vertexColors: true,
      map: asphaltTex.map,
      bumpMap: asphaltTex.bumpMap,
      bumpScale: 0.055,
      roughnessMap: asphaltTex.roughnessMap,
      roughness: 0.96,
      metalness: 0.01,
    });

    const sidewalkMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      vertexColors: true,
      map: promenadeTex.map,
      bumpMap: promenadeTex.bumpMap,
      bumpScale: 0.038,
      roughness: 0.76,
      metalness: 0.02,
    });

    const sandMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      vertexColors: true,
      map: sandTex.map,
      bumpMap: sandTex.bumpMap,
      bumpScale: 0.055,
      roughness: 0.92,
      metalness: 0.0,
    });

    const marksMat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.52,
      metalness: 0.02,
    });

    this.glowMat = new THREE.MeshBasicMaterial({
      vertexColors: true,
      fog: false,
    });

    const add = (kit: MeshKit, mat: THREE.Material, shadow = true) => {
      if (!kit.pos.length) return;
      const m = new THREE.Mesh(kit.geometry(), mat);
      m.castShadow = shadow && !G.isSoftwareGl;
      m.receiveShadow = !G.isSoftwareGl;
      G.scene.add(m);
    };

    add(this.walls, wallMat, true);
    add(this.towers, towerMat, true);
    add(this.portWalls, portMat, true);
    add(this.tileRoofs, roofMat, true);
    add(
      this.trim,
      new THREE.MeshStandardMaterial({
        vertexColors: true,
        roughness: 0.62,
        metalness: 0.08,
      }),
      true,
    );
    add(this.roads, this.roadMat, false);
    add(this.roadMarks, marksMat, false);
    add(this.sidewalks, sidewalkMat, false);
    add(this.beachSand, sandMat, false);
    add(this.glow, this.glowMat, false);
    return this;
  }

  private buildGround(): void {
    const c = this.G.collision;
    // Textured coastal asphalt bed
    this.roads.box(
      SIZE / 2,
      -0.05,
      SIZE / 2,
      SIZE + 100,
      0.1,
      SIZE + 100,
      rgb('#c5c9d6'),
      { uvScale: 0.11 },
    );

    // Sandy perimeter dunes & Sunset Beach
    const duneCol = rgb('#d4c29a');
    this.beachSand.box(SIZE + 330, -0.06, SIZE / 2, 500, 0.1, 1400, duneCol, {
      uvScale: 0.07,
    });
    this.beachSand.box(SIZE / 2, -0.06, -300, 1400, 0.1, 500, duneCol, {
      uvScale: 0.07,
    });
    this.beachSand.box(SIZE / 2, -0.06, SIZE + 300, 1400, 0.1, 500, duneCol, {
      uvScale: 0.07,
    });
    this.beachSand.box(
      -ROAD / 2 - BEACH_W / 2,
      -0.02,
      SIZE / 2,
      BEACH_W,
      0.12,
      SIZE + 700,
      rgb('#fff6e4'),
      { uvScale: 0.12 },
    );

    // Ocean Drive coral-stone promenade
    this.sidewalks.box(
      -ROAD / 2 - 3.2,
      0.13,
      SIZE / 2,
      6.4,
      0.26,
      SIZE + 100,
      rgb('#f0c8b4'),
      { uvScale: 0.24 },
    );

    // Balustrade wall along the beach edge with clean openings at the Pier & beach access stairs
    for (let z = -40; z < SIZE + 40; z += 4) {
      // Wide opening for Vice Lighthouse Pier approach
      if (Math.abs(z - PIER_Z) < 6.8) continue;
      // Periodic beach access stairs every 2 blocks (z ≈ 108, 396, 540)
      const isBeachStair =
        Math.abs(z - 108) < 3.5 || Math.abs(z - 396) < 3.5 || Math.abs(z - 540) < 3.5;
      if (isBeachStair) {
        this.sidewalks.box(-ROAD / 2 - 6.8, 0.09, z, 1.4, 0.18, 3.6, rgb('#ece3d6'), {
          uvScale: 0.3,
        });
        continue;
      }
      this.trim.box(-ROAD / 2 - 6.35, 0.55, z, 0.36, 0.68, 3.4, rgb('#f6efe6'));
      this.trim.box(-ROAD / 2 - 6.35, 0.92, z, 0.48, 0.1, 3.6, rgb('#fff9f2'));
    }

    // Crisp lane markings and crosswalks (Y offset +0.025 above asphalt)
    const yel = rgb('#f5c538', 1.1);
    const wht = rgb('#ecebe6');
    for (let k = 0; k <= GRID; k++) {
      for (let j = 0; j < GRID; j++) {
        const a = j * BLOCK + ROAD / 2 + 3;
        const b = (j + 1) * BLOCK - ROAD / 2 - 3;
        const mid = (a + b) / 2;
        const len = b - a;
        const p = k * BLOCK;
        for (const o of [-0.18, 0.18]) {
          this.roadMarks.box(p + o, 0.025, mid, 0.14, 0.02, len, yel);
          this.roadMarks.box(mid, 0.025, p + o, len, 0.02, 0.14, yel);
        }
        for (let s = -2; s <= 2; s++) {
          for (const e of [a - 1.6, b + 1.6]) {
            this.roadMarks.box(p + s * 2.6, 0.028, e, 1.3, 0.02, 2.4, wht);
            this.roadMarks.box(e, 0.028, p + s * 2.6, 2.4, 0.02, 1.3, wht);
          }
        }
      }
    }
    c.addBox(SIZE + 40, -2000, SIZE + 400, 2000, 3);
  }

  private slab(
    kit: MeshKit,
    x0: number,
    z0: number,
    x1: number,
    z1: number,
    h: number,
    color: [number, number, number],
    uvScale = 0.2,
  ): void {
    kit.box((x0 + x1) / 2, h / 2, (z0 + z1) / 2, x1 - x0, h, z1 - z0, color, {
      uvScale,
    });
  }

  private buildLot(lot: LotDef): void {
    const r = this.rng;
    const d = lot.district;
    // Coral-stone sidewalk curb
    this.slab(this.sidewalks, lot.x0, lot.z0, lot.x1, lot.z1, 0.22, rgb('#dfd8cc'), 0.22);
    const ix0 = lot.x0 + WALK;
    const iz0 = lot.z0 + WALK;
    const ix1 = lot.x1 - WALK;
    const iz1 = lot.z1 - WALK;
    const park =
      (d === 'heights' && lot.bx === 2 && lot.bz === 0) ||
      (lot.bx === 3 && lot.bz === 3);
    const inner =
      park || d === 'heights' ? '#5e9b52' : d === 'port' ? '#8c867c' : '#c6bcb0';
    this.slab(
      park || d === 'heights' ? this.trim : this.sidewalks,
      ix0,
      iz0,
      ix1,
      iz1,
      0.26,
      rgb(inner),
      0.18,
    );
    if (park) {
      // Landscaped park stone walkways
      const cx = (ix0 + ix1) / 2;
      const cz = (iz0 + iz1) / 2;
      this.sidewalks.box(cx, 0.29, cz, ix1 - ix0, 0.06, 3.6, rgb('#e5ddd0'), { uvScale: 0.3 });
      this.sidewalks.box(cx, 0.29, cz, 3.6, 0.06, iz1 - iz0, rgb('#e5ddd0'), { uvScale: 0.3 });
      // Central stone fountain basin
      this.trim.cyl(cx, 0.55, cz, 3.8, 4.1, 0.65, 16, rgb('#efe8dc'));
      this.trim.cyl(cx, 0.72, cz, 3.2, 3.2, 0.18, 16, rgb('#2fd4e0', 1.1));
      this.trim.cyl(cx, 1.3, cz, 0.55, 0.85, 1.4, 12, rgb('#f4efe6'));
      this.parks.push(lot);
      return;
    }
    const W = ix1 - ix0;
    if (d === 'downtown') {
      if (r.chance(0.5)) {
        this.tower(ix0 + W / 2, iz0 + W / 2, 30, 30, r.range(60, 115));
      } else {
        this.tower(ix0 + 11, iz0 + W / 2, 20, 38, r.range(38, 80));
        this.tower(ix1 - 12, iz0 + W / 2, 22, 30, r.range(45, 95));
      }
    } else if (d === 'malecon') {
      for (const [a, b] of [
        [0, 0],
        [0, 1],
        [1, 0],
        [1, 1],
      ]) {
        const cx = ix0 + W / 4 + (a * W) / 2;
        const cz = iz0 + W / 4 + (b * W) / 2;
        // Street-facing facade direction: west hotels face -X, east hotels face +X (no inner-courtyard clipping)
        const faceDir = a === 0 ? -1 : 1;
        this.hotel(cx, cz, 20.5, 20.5, r.range(14, 36), a === 0 && lot.bx === 0, faceDir);
      }
    } else if (d === 'heights') {
      for (const [a, b] of [
        [0, 0],
        [0, 1],
        [1, 0],
        [1, 1],
      ]) {
        this.villa(ix0 + W / 4 + (a * W) / 2, iz0 + W / 4 + (b * W) / 2, a === 0 ? -1 : 1);
      }
    } else if (d === 'neon') {
      const n = 3;
      for (let i = 0; i < n; i++) {
        for (let j = 0; j < 2; j++) {
          const w = W / n - 1.5;
          const cx = ix0 + w / 2 + i * (W / n) + 0.75;
          const cz = iz0 + W / 4 + (j * W) / 2;
          this.club(cx, cz, w, W / 2 - 2, r.range(8, 22), j === 0 ? -1 : 1);
        }
      }
    } else {
      this.warehouse(ix0, iz0, ix1, iz1);
    }
  }

  private solid(cx: number, cz: number, w: number, dd: number, h: number): void {
    this.G.collision.addBox(cx - w / 2, cz - dd / 2, cx + w / 2, cz + dd / 2, h);
    this.buildingTops.push({ x: cx, z: cz, w, d: dd, h });
  }

  private tower(cx: number, cz: number, w: number, d: number, h: number): void {
    const col = rgb(this.rng.pick(TOWER));
    this.towers.box(cx, h / 2, cz, w, h, d, col, { uvScale: 0.14 });
    this.towers.box(cx, h + 4, cz, w * 0.72, 8, d * 0.72, col, { uvScale: 0.14 });
    this.trim.box(cx, h + 8.4, cz, w * 0.76, 0.8, d * 0.76, rgb('#d9dde2'));
    // Rooftop mechanical unit & comms spire
    this.trim.box(cx + w * 0.12, h + 10.1, cz - d * 0.1, w * 0.28, 2.6, d * 0.24, rgb('#8e96a2'));
    this.trim.cyl(cx - w * 0.14, h + 13.5, cz + d * 0.1, 0.12, 0.26, 9, 8, rgb('#cfd6df'));
    const neon = rgb(this.rng.pick(['#00f0d8', '#ff2e93', '#ff9b54']), 3.2);
    for (const [ox, oz, sw, sd] of [
      [0, d * 0.36, w * 0.72, 0.3],
      [0, -d * 0.36, w * 0.72, 0.3],
      [w * 0.36, 0, 0.3, d * 0.72],
      [-w * 0.36, 0, 0.3, d * 0.72],
    ]) {
      this.glow.box(cx + ox, h + 7.6, cz + oz, sw + 0.1, 0.5, sd + 0.1, neon);
    }
    // Ground-floor stone podium canopy
    this.trim.box(cx, 2.4, cz, w + 1.4, 0.65, d + 1.4, rgb('#e8e3d8'));
    this.solid(cx, cz, w, d, h);
  }

  private hotel(
    cx: number,
    cz: number,
    w: number,
    d: number,
    h: number,
    faceBeach: boolean,
    faceDir: -1 | 1,
  ): void {
    const r = this.rng;
    const col = rgb(r.pick(PASTEL));
    const white = rgb('#fbf6ee');
    this.walls.box(cx, h / 2, cz, w, h, d, col, { uvScale: 0.16 });
    this.walls.box(cx, h + 2.5, cz, w * 0.58, 5, d * 0.58, col, { uvScale: 0.16 });
    this.trim.box(cx, h + 0.3, cz, w + 0.6, 0.6, d + 0.6, white);
    this.trim.box(cx, h + 5.2, cz, w * 0.62, 0.5, d * 0.62, white);
    // Rooftop AC units
    this.trim.box(cx - faceDir * 2.4, h + 1.2, cz + 3.2, 2.4, 1.3, 2.0, rgb('#9ba2ac'));

    // Street-facing Art-Deco balconies, eyebrow fin, neon strip & fabric awning (never clipping inner neighbors)
    const fx = cx + faceDir * (w / 2);
    for (let y = 7.2; y < h - 1; y += 3.4) {
      this.trim.box(fx + faceDir * 0.55, y, cz, 1.1, 0.18, d * 0.78, white);
      // Slim balcony handrail
      this.trim.box(fx + faceDir * 1.05, y + 0.65, cz, 0.08, 0.1, d * 0.76, rgb('#d7dfe6'));
    }
    this.trim.box(fx - faceDir * 0.2, h / 2 + 2, cz, 0.75, h - 2, 2.3, white);
    this.glow.box(
      fx + faceDir * 0.25,
      3.3,
      cz,
      0.26,
      0.22,
      d * 0.88,
      rgb(r.pick(['#ff2e93', '#00f0d8']), 2.6),
    );
    this.trim.box(
      fx + faceDir * 1.25,
      3.2,
      cz,
      2.3,
      0.2,
      d * 0.78,
      rgb(r.pick(['#00bfa8', '#ff4d8d', '#ff9b54'])),
      { tx: 1, sx: -faceDir * 0.35 },
    );
    if (faceBeach && r.chance(0.85)) {
      this.sign(
        r.pick(HOTELS),
        r.pick(NEONCOL),
        fx - 0.35,
        h - 3.5,
        cz,
        -1,
        0,
        Math.min(d * 0.92, 17.5),
      );
    }
    this.solid(cx, cz, w, d, h);
  }

  private villa(cx: number, cz: number, poolSide: -1 | 1): void {
    const r = this.rng;
    const w = r.range(12.5, 16.5);
    const d = r.range(11.5, 15.5);
    const h = r.range(4.4, 7.6);
    const wall = rgb(r.pick(['#f7f1e6', '#f4e3cc', '#eaf1f4', '#f6ddd6']));
    this.walls.box(cx, h / 2, cz, w, h, d, wall, { uvScale: 0.2 });
    // Textured Mediterranean terracotta barrel-tile hip roof
    this.tileRoofs.box(cx, h + 1.35, cz, w + 1.4, 2.7, d + 1.4, rgb('#ffffff'), {
      tx: 0.32,
      tz: 0.48,
      uvScale: 0.32,
    });
    // White stucco roof cornice
    this.trim.box(cx, h + 0.05, cz, w + 0.9, 0.3, d + 0.9, rgb('#faf6ef'));
    // Courtyard swimming pool kept safely inside the villa quadrant
    const px = cx - poolSide * (w / 2 + 2.1);
    this.trim.box(px, 0.36, cz, 3.6, 0.26, d * 0.62, rgb('#ede6da'));
    this.trim.box(px, 0.48, cz, 3.0, 0.14, d * 0.54, rgb('#2fd4e8', 1.12));
    this.solid(cx, cz, w, d, h);
  }

  private club(
    cx: number,
    cz: number,
    w: number,
    d: number,
    h: number,
    side: number,
  ): void {
    const r = this.rng;
    this.walls.box(cx, h / 2, cz, w, h, d, rgb(r.pick(NEONWALL)), { uvScale: 0.2 });
    this.trim.box(cx, h + 0.3, cz, w + 0.4, 0.6, d + 0.4, rgb('#191628'));
    const neon = r.pick(NEONCOL);
    const fz = cz + side * (d / 2 + 0.3);
    this.glow.box(cx, 3.4, fz, w * 0.9, 0.22, 0.2, rgb(neon, 3));
    this.glow.box(cx, h - 0.6, fz, w * 0.95, 0.18, 0.2, rgb(r.pick(NEONCOL), 2.6));
    this.sign(
      r.pick(CLUBS),
      neon,
      cx,
      Math.min(h - 2.5, 7 + r.range(0, 4)),
      fz + side * 0.1,
      0,
      side,
      Math.min(w * 0.9, 13),
    );
    this.solid(cx, cz, w, d, h);
  }

  private warehouse(ix0: number, iz0: number, ix1: number, iz1: number): void {
    const r = this.rng;
    const w = ix1 - ix0 - 4;
    const d = 26;
    const h = r.range(9, 13);
    const cz = iz0 + d / 2 + 1;
    const cx = (ix0 + ix1) / 2;
    this.portWalls.box(cx, h / 2, cz, w, h, d, rgb(r.pick(PORT)), { uvScale: 0.22 });
    this.trim.box(cx, h + 1.2, cz, w + 0.6, 2.4, d + 0.6, rgb('#6f7377'), {
      tz: 0.15,
    });
    this.trim.box(cx, 2.6, cz + d / 2 + 0.05, 8, 5, 0.2, rgb('#3b3f45'));
    this.solid(cx, cz, w, d, h);
    for (let i = 0; i < 4; i++) {
      for (let s = 0; s < r.int(1, 3); s++) {
        const x = ix0 + 5 + i * 6.6;
        const z = iz1 - 7;
        const col = rgb(r.pick(PORT));
        this.portWalls.box(x, 1.3 + s * 2.6, z, 2.4, 2.6, 12, col, { uvScale: 0.3 });
        if (s === 0) this.G.collision.addBox(x - 1.2, z - 6, x + 1.2, z + 6, 3);
      }
    }
  }

  sign(
    text: string,
    color: string,
    x: number,
    y: number,
    z: number,
    nx: number,
    nz: number,
    width: number,
  ): THREE.Mesh {
    const mat = new THREE.MeshBasicMaterial({
      map: neonTexture(text, color),
      transparent: true,
      depthWrite: false,
      fog: false,
    });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(width, width / 4), mat);
    m.position.set(x + nx * 0.22, y, z + nz * 0.22);
    m.rotation.y = Math.atan2(nx, nz);
    this.G.scene.add(m);
    this.signs.push(m);
    return m;
  }

  update(sky: any, dt = 0.016): void {
    const s = this.shared;
    const e = sky.sunDir.y;
    s.uNight.value = clamp(sky.night * 1.2 + clamp((0.12 - e) * 2, 0, 0.4), 0, 1);
    s.uGlint.value = clamp(1 - e / 0.45, 0, 1) * (1 - sky.night) * 0.78;
    s.uSunDir.value.copy(sky.sunDir);
    s.uSunCol.value.copy(sky.sun.color);
    const k = 1.0 + s.uNight.value * 0.95;
    this.glowMat.color.setScalar(0.62 + s.uNight.value * 0.9);
    for (const m of this.signs) {
      (m.material as THREE.MeshBasicMaterial).color.setScalar(k);
    }

    // Dynamic wet reflective asphalt during Tropical Storm & Midnight drizzle
    const wSpec = sky.spec();
    this.roadMat.roughness = damp(this.roadMat.roughness, wSpec.roadRoughness, 1.5, dt);
    this.roadMat.metalness = damp(this.roadMat.metalness, wSpec.roadMetalness, 1.5, dt);
  }
}
