// CarModels: 11 photorealistic Vice Coast vehicles with high-segment sculpted bodies,
// LatheGeometry rounded rubber tires + 5-spoke metallic alloy rims + brake discs & red calipers,
// semi-transparent tinted glass cabins with visible interior dashboard/seats, Vice Coast plates,
// twin chrome exhausts, LED projector headlamps, clearcoat metallic paint, and feathered shadows.
import * as THREE from 'three';
import { MeshKit, rgb } from '../render/MeshKit.ts';
import {
  createCarbonBumpTex,
  createCarShadowTex,
  createLicensePlateTex,
  createTireTreadTex,
  glowTexture,
} from '../render/Textures.ts';

export type PaintFinish = 'gloss' | 'matte' | 'pearl';

export interface CarSpec {
  name: string;
  len: number;
  wid: number;
  h: number;
  p: [number, number, number, number, number, number];
  kind: 'sport' | 'sedan' | 'cabrio' | 'suv' | 'taxi' | 'police' | 'van' | 'hyper' | 'armored';
  top: number;
  acc: number;
  grip: number;
  mass: number;
}

export const CAR_SPECS: Record<string, CarSpec> = {
  comet: {
    name: 'Viper Comet RS',
    len: 4.55,
    wid: 1.98,
    h: 1.2,
    p: [0.62, 0.86, 0.36, 0.17, 0.85, 0.95],
    kind: 'sport',
    top: 58,
    acc: 15,
    grip: 7.5,
    mass: 1.1,
  },
  solaris: {
    name: 'Solaris V12',
    len: 4.78,
    wid: 2.1,
    h: 1.1,
    p: [0.52, 0.78, 0.42, 0.12, 0.96, 1.18],
    kind: 'hyper',
    top: 70,
    acc: 20,
    grip: 8.6,
    mass: 1.05,
  },
  marea: {
    name: 'Bayview Sedan',
    len: 4.7,
    wid: 1.88,
    h: 1.45,
    p: [0.74, 0.97, 0.27, 0.22, 0.62, 0.55],
    kind: 'sedan',
    top: 44,
    acc: 10,
    grip: 6,
    mass: 1.2,
  },
  palma: {
    name: 'Sunset Cabrio',
    len: 4.35,
    wid: 1.88,
    h: 1.25,
    p: [0.66, 0.9, 0.33, 0.25, 0.3, 0.2],
    kind: 'cabrio',
    top: 50,
    acc: 12,
    grip: 6.5,
    mass: 1,
  },
  tortuga: {
    name: 'Ridge 4x4',
    len: 4.8,
    wid: 2.02,
    h: 1.92,
    p: [0.98, 1.18, 0.22, 0.04, 0.5, 0.18],
    kind: 'suv',
    top: 42,
    acc: 10,
    grip: 5.5,
    mass: 1.6,
  },
  taxi: {
    name: 'Vice Coast Cab',
    len: 4.7,
    wid: 1.88,
    h: 1.47,
    p: [0.74, 0.97, 0.27, 0.22, 0.62, 0.55],
    kind: 'taxi',
    top: 44,
    acc: 10,
    grip: 6,
    mass: 1.2,
  },
  aureo: {
    name: 'Apex GT',
    len: 4.62,
    wid: 2.02,
    h: 1.14,
    p: [0.58, 0.82, 0.4, 0.14, 0.9, 1.1],
    kind: 'sport',
    top: 64,
    acc: 17,
    grip: 8,
    mass: 1.1,
  },
  police: {
    name: 'VCPD Interceptor',
    len: 4.95,
    wid: 1.96,
    h: 1.48,
    p: [0.76, 0.99, 0.28, 0.2, 0.62, 0.55],
    kind: 'police',
    top: 56,
    acc: 14,
    grip: 7,
    mass: 1.5,
  },
  swat: {
    name: 'VCPD Tactical',
    len: 5.6,
    wid: 2.25,
    h: 2.55,
    p: [1.05, 1.25, 0.14, 0.0, 0.42, 0.04],
    kind: 'van',
    top: 44,
    acc: 11,
    grip: 6,
    mass: 2.6,
  },
  van: {
    name: 'Harbor Cargo Van',
    len: 5.3,
    wid: 2.08,
    h: 2.35,
    p: [1.0, 1.2, 0.14, 0.0, 0.45, 0.04],
    kind: 'van',
    top: 38,
    acc: 8,
    grip: 5,
    mass: 2,
  },
  cashvan: {
    name: 'Armored Cash Van',
    len: 5.5,
    wid: 2.18,
    h: 2.48,
    p: [1.02, 1.22, 0.16, 0.0, 0.42, 0.04],
    kind: 'armored',
    top: 40,
    acc: 9.5,
    grip: 5.6,
    mass: 2.8,
  },
};

export const PAINTS = [
  '#e0244a',
  '#f4f5f8',
  '#00b8a9',
  '#2078e0',
  '#f5b324',
  '#ff2e93',
  '#1b202b',
  '#8239c4',
  '#ff6f3c',
  '#00d8e0',
  '#c5ccd6',
  '#3fa364',
];

export const UNDERGLOW_COLORS: Array<{ label: string; color: string | null }> = [
  { label: 'Off', color: null },
  { label: 'Miami Aqua', color: '#00f0d8' },
  { label: 'Flamingo Pink', color: '#ff2e93' },
  { label: 'Coral Sunset', color: '#ff7c5c' },
  { label: 'Electric Violet', color: '#a855f7' },
];

export const TRAFFIC_MODELS = [
  'marea',
  'marea',
  'palma',
  'tortuga',
  'taxi',
  'comet',
  'van',
  'marea',
  'tortuga',
];

const geoCache = new Map<
  string,
  { body: THREE.BufferGeometry; glass: THREE.BufferGeometry | null; roof: THREE.BufferGeometry | null }
>();
let carbonBump: THREE.CanvasTexture | null = null;
let sharedWheelGeo: {
  tire: THREE.BufferGeometry;
  rim: THREE.BufferGeometry;
  lip: THREE.BufferGeometry;
  rotor: THREE.BufferGeometry;
  spoke: THREE.BufferGeometry;
  caliper: THREE.BufferGeometry;
  cap: THREE.BufferGeometry;
} | null = null;
let sharedWheelMats: {
  tire: THREE.MeshStandardMaterial;
  alloy: THREE.MeshStandardMaterial;
  alloyDark: THREE.MeshStandardMaterial;
  rotor: THREE.MeshStandardMaterial;
  caliper: THREE.MeshStandardMaterial;
} | null = null;
let plateMat: THREE.MeshStandardMaterial | null = null;

function getCarbonBump(): THREE.CanvasTexture {
  if (!carbonBump) carbonBump = createCarbonBumpTex(4);
  return carbonBump;
}

function getWheelAssets() {
  if (!sharedWheelGeo) {
    // Realistic rounded-shoulder rubber tire profile via LatheGeometry (axis Y -> rotated to X)
    const pts = [
      new THREE.Vector2(0.242, -0.142),
      new THREE.Vector2(0.325, -0.146),
      new THREE.Vector2(0.366, -0.116),
      new THREE.Vector2(0.378, -0.072),
      new THREE.Vector2(0.382, 0.0),
      new THREE.Vector2(0.378, 0.072),
      new THREE.Vector2(0.366, 0.116),
      new THREE.Vector2(0.325, 0.146),
      new THREE.Vector2(0.242, 0.142),
    ];
    const tire = new THREE.LatheGeometry(pts, 28);
    tire.rotateZ(Math.PI / 2);

    const rim = new THREE.CylinderGeometry(0.248, 0.248, 0.24, 24, 1, true);
    rim.rotateZ(Math.PI / 2);

    // Machined outer alloy rim lip
    const lip = new THREE.TorusGeometry(0.248, 0.018, 8, 24);
    lip.rotateY(Math.PI / 2);

    const rotor = new THREE.CylinderGeometry(0.195, 0.195, 0.036, 18);
    rotor.rotateZ(Math.PI / 2);

    const spoke = new THREE.BoxGeometry(0.034, 0.23, 0.036);
    const caliper = new THREE.BoxGeometry(0.056, 0.098, 0.056);
    const cap = new THREE.CylinderGeometry(0.052, 0.052, 0.052, 14);
    cap.rotateZ(Math.PI / 2);

    sharedWheelGeo = { tire, rim, lip, rotor, spoke, caliper, cap };
  }
  if (!sharedWheelMats) {
    sharedWheelMats = {
      tire: new THREE.MeshStandardMaterial({
        color: '#15171d',
        bumpMap: createTireTreadTex(4),
        bumpScale: 0.028,
        roughness: 0.88,
        metalness: 0.03,
      }),
      alloy: new THREE.MeshStandardMaterial({
        color: '#e4eaf2',
        roughness: 0.16,
        metalness: 0.92,
      }),
      alloyDark: new THREE.MeshStandardMaterial({
        color: '#222732',
        roughness: 0.42,
        metalness: 0.72,
      }),
      rotor: new THREE.MeshStandardMaterial({
        color: '#8f98a6',
        roughness: 0.36,
        metalness: 0.82,
      }),
      caliper: new THREE.MeshStandardMaterial({
        color: '#d91e41',
        roughness: 0.28,
        metalness: 0.48,
      }),
    };
  }
  return { geo: sharedWheelGeo, mats: sharedWheelMats };
}

function buildWheelMesh(side: number, isSoftwareGl: boolean): THREE.Group {
  const { geo, mats } = getWheelAssets();
  const wg = new THREE.Group();

  const tire = new THREE.Mesh(geo.tire, mats.tire);
  tire.castShadow = !isSoftwareGl;
  wg.add(tire);

  const rim = new THREE.Mesh(geo.rim, mats.alloyDark);
  wg.add(rim);

  const lip = new THREE.Mesh(geo.lip, mats.alloy);
  lip.position.x = side * 0.118;
  wg.add(lip);

  const rotor = new THREE.Mesh(geo.rotor, mats.rotor);
  rotor.position.x = side * 0.025;
  wg.add(rotor);

  // Concave 5-spoke machined alloy wheel star
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const sp = new THREE.Mesh(geo.spoke, mats.alloy);
    sp.position.set(side * 0.105, Math.cos(a) * 0.116, Math.sin(a) * 0.116);
    sp.rotation.x = a;
    wg.add(sp);
  }

  // Center lug cap
  const cap = new THREE.Mesh(geo.cap, mats.alloyDark);
  cap.position.x = side * 0.106;
  wg.add(cap);

  // Performance brake caliper tucked behind spokes
  const cal = new THREE.Mesh(geo.caliper, mats.caliper);
  cal.position.set(side * 0.032, 0.088, -0.095);
  wg.add(cal);

  return wg;
}

const sharedGlow = () =>
  new THREE.SpriteMaterial({
    map: glowTexture(),
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    fog: false,
  });

const extrude = (shape: THREE.Shape, width: number, bevel = 0.09) => {
  const g = new THREE.ExtrudeGeometry(shape, {
    depth: width - bevel * 2,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel * 0.85,
    bevelSegments: 4,
    curveSegments: 20,
  });
  g.translate(0, 0, -(width - bevel * 2) / 2);
  g.rotateY(-Math.PI / 2);
  g.computeVertexNormals();
  return g;
};

function bodyGeometry(model: string) {
  if (geoCache.has(model)) return geoCache.get(model)!;
  const s = CAR_SPECS[model];
  const L = s.len;
  const W = s.wid;
  const [noseY, belt, hoodF, bootF, ws, rear] = s.p;
  const f = -L / 2;
  const r = L / 2;
  const base = 0.34;
  // Generous 0.49m wheel arch cutout so rounded tires sit cleanly inside dark wells with zero clipping
  const R = 0.49;
  const wz = L * 0.33;
  const trunk = belt - 0.03;

  const b = new THREE.Shape();
  b.moveTo(f, base + 0.04);
  b.quadraticCurveTo(f - 0.05, base + 0.24, f + 0.03, noseY - 0.03);
  b.quadraticCurveTo(f + 0.1, noseY + 0.04, f + 0.36, noseY + 0.07);
  b.quadraticCurveTo(f + L * hoodF * 0.62, belt - 0.015, f + L * hoodF, belt);
  b.lineTo(r - L * bootF, belt + 0.01);
  b.quadraticCurveTo(r - 0.06, trunk + 0.01, r, trunk - 0.13);
  b.lineTo(r + 0.03, base + 0.1);
  b.lineTo(r - 0.06, base);
  b.lineTo(wz + R, base);
  b.absarc(wz, 0.38, R, 0, Math.PI, false);
  b.lineTo(-wz + R, base);
  b.absarc(-wz, 0.38, R, 0, Math.PI, false);
  b.lineTo(f, base + 0.04);
  const body = extrude(b, W, 0.085);

  let glass: THREE.BufferGeometry | null = null;
  let roof: THREE.BufferGeometry | null = null;
  if (s.kind !== 'cabrio') {
    const g0 = f + L * hoodF - 0.04;
    const g3 = r - L * bootF + 0.04;
    const g1 = g0 + ws;
    const g2 = Math.max(g1 + 0.24, g3 - rear);
    const gs = new THREE.Shape();
    gs.moveTo(g0, belt - 0.015);
    gs.lineTo(g1, s.h - 0.015);
    gs.lineTo(g2, s.h - 0.015);
    gs.lineTo(g3, belt - 0.015);
    gs.lineTo(g0, belt - 0.015);
    glass = extrude(gs, W * 0.84, 0.045);

    // Flush aerodynamic roof cap cleanly matching the greenhouse crown
    const rs = new THREE.Shape();
    rs.moveTo(g1 + 0.01, s.h - 0.035);
    rs.lineTo(g2 - 0.01, s.h - 0.035);
    rs.lineTo(g2 - 0.05, s.h + 0.018);
    rs.lineTo(g1 + 0.06, s.h + 0.018);
    rs.lineTo(g1 + 0.01, s.h - 0.035);
    roof = extrude(rs, W * 0.81, 0.025);
    roof.userData = { g0, g1, g2, g3 };
  }
  const out = { body, glass, roof };
  geoCache.set(model, out);
  return out;
}

export function applyPaintFinish(
  mat: THREE.MeshPhysicalMaterial,
  finish: PaintFinish,
): void {
  if (finish === 'matte') {
    mat.roughness = 0.68;
    mat.metalness = 0.22;
    mat.clearcoat = 0.12;
    mat.clearcoatRoughness = 0.5;
    mat.bumpMap = getCarbonBump();
    mat.bumpScale = 0.016;
  } else if (finish === 'pearl') {
    mat.roughness = 0.16;
    mat.metalness = 0.72;
    mat.clearcoat = 1.0;
    mat.clearcoatRoughness = 0.03;
    mat.iridescence = 0.85;
    mat.bumpMap = null;
  } else {
    mat.roughness = 0.22;
    mat.metalness = 0.54;
    mat.clearcoat = 1.0;
    mat.clearcoatRoughness = 0.04;
    mat.iridescence = 0.12;
    mat.bumpMap = null;
  }
  mat.needsUpdate = true;
}

export function buildCar(model: string, paint: string, isSoftwareGl = false) {
  const s = CAR_SPECS[model];
  const L = s.len;
  const W = s.wid;
  const [, belt, hoodF] = s.p;
  const police = s.kind === 'police' || model === 'swat';
  const armored = s.kind === 'armored';
  const geo = bodyGeometry(model);
  const g = new THREE.Group();

  const paintMat = new THREE.MeshPhysicalMaterial({
    color: police ? '#f4f6fa' : armored ? '#1c2834' : paint,
    roughness: 0.22,
    metalness: 0.54,
    clearcoat: 1.0,
    clearcoatRoughness: 0.04,
    iridescence: 0.12,
  });
  // Deep reflective tinted automotive glass revealing interior cabin depth
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: '#070e18',
    roughness: 0.03,
    metalness: 0.48,
    clearcoat: 1.0,
    clearcoatRoughness: 0.02,
    transparent: true,
    opacity: 0.82,
  });
  const darkMat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.34,
    metalness: 0.58,
  });
  const lampMat = new THREE.MeshBasicMaterial({
    vertexColors: true,
    fog: false,
  });

  const add = (geom: THREE.BufferGeometry, mat: THREE.Material) => {
    const m = new THREE.Mesh(geom, mat);
    m.castShadow = !isSoftwareGl;
    m.receiveShadow = !isSoftwareGl;
    g.add(m);
    return m;
  };

  add(geo.body, paintMat);
  if (geo.glass && geo.roof) {
    add(geo.glass, glassMat);
    add(geo.roof, paintMat);
  }

  // Soft feathered elliptical ambient occlusion contact shadow (no hard rectangular box edge)
  const shadowDisc = new THREE.Mesh(
    new THREE.PlaneGeometry(W * 1.48, L * 1.24),
    new THREE.MeshBasicMaterial({
      map: createCarShadowTex(),
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
    }),
  );
  shadowDisc.rotation.x = -Math.PI / 2;
  shadowDisc.position.y = 0.032;
  g.add(shadowDisc);

  // Optional Neon Underglow plane
  const underglowMat = new THREE.MeshBasicMaterial({
    map: glowTexture(),
    color: 0x00f0d8,
    transparent: true,
    opacity: 0.85,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const underglow = new THREE.Mesh(
    new THREE.PlaneGeometry(W * 1.65, L * 1.35),
    underglowMat,
  );
  underglow.rotation.x = -Math.PI / 2;
  underglow.position.y = 0.048;
  underglow.visible = s.kind === 'hyper';
  g.add(underglow);

  const k = new MeshKit();
  const lamps = new MeshKit();
  const trim = rgb('#14171f');
  const carbon = rgb('#1d222c');
  const chrome = rgb('#e2e7ef');
  const interior = rgb('#242730');

  // Sculpted front chin splitter, lower diffuser & side aero skirts
  k.box(0, 0.36, -L / 2 - 0.04, W * 0.96, 0.08, 0.22, carbon);
  k.box(0, 0.36, L / 2 + 0.04, W * 0.94, 0.1, 0.2, carbon);
  k.box(0, 0.52, -L / 2 - 0.04, W * 0.94, 0.16, 0.12, trim);
  k.box(0, 0.52, L / 2 + 0.04, W * 0.94, 0.16, 0.12, trim);

  // Recessed radiator intake grille with chrome surround on sedans/SUVs
  k.box(0, 0.62, -L / 2 - 0.055, W * 0.54, 0.16, 0.05, trim);
  if (s.kind !== 'sport' && s.kind !== 'hyper') {
    k.box(0, 0.71, -L / 2 - 0.06, W * 0.56, 0.025, 0.05, chrome);
    k.box(0, 0.53, -L / 2 - 0.06, W * 0.56, 0.025, 0.05, chrome);
  }

  // Twin chrome exhaust tailpipes
  for (const side of [-1, 1]) {
    const ex = side * (s.kind === 'hyper' ? W * 0.14 : W * 0.31);
    k.cyl(ex, 0.4, L / 2 + 0.08, 0.055, 0.055, 0.14, 10, chrome, {
      m: new THREE.Matrix4().makeRotationX(Math.PI / 2),
    });
  }

  // Side aero skirts & recessed dark underbody chassis pan (eliminates empty see-through wheel wells)
  const wz = L * 0.33;
  const noseY = s.p[0];
  k.box(0, 0.42, 0, W * 0.7, 0.16, L * 0.86, trim);
  for (const x of [-1, 1]) {
    k.box(x * (W / 2 + 0.01), 0.36, 0, 0.05, 0.08, L * 0.42, carbon);
  }

  // Cabin interior silhouette (dashboard, steering wheel, twin sport headrests)
  k.box(0, belt + 0.04, -L * 0.08, W * 0.72, 0.18, 0.38, interior);
  for (const sx of [-W * 0.21, W * 0.21]) {
    k.box(sx, belt + 0.22, 0.35, 0.34, 0.32, 0.12, interior);
  }

  if (geo.roof) {
    const { g0, g1, g2 } = geo.roof.userData;
    for (const x of [-1, 1]) {
      // Stalked aerodynamic wing mirrors
      k.box(x * (W / 2 + 0.055), belt + 0.055, g0 + 0.18, 0.13, 0.035, 0.055, trim);
      k.box(x * (W / 2 + 0.14), belt + 0.09, g0 + 0.2, 0.17, 0.09, 0.13, carbon);
      // Crisp B-pillar divider
      k.box(
        x * W * 0.415,
        (belt + s.h) / 2,
        (g1 + g2) / 2,
        0.04,
        s.h - belt - 0.02,
        0.12,
        trim,
      );
      // Flush metallic door handle accent
      k.box(x * (W / 2 + 0.012), belt - 0.11, 0.12, 0.022, 0.03, 0.18, chrome);
    }
  } else {
    // Convertible raked windshield frame & leather interior
    for (const x of [-1, 1]) {
      k.box(x * W * 0.42, belt + 0.22, -L / 2 + L * hoodF + 0.14, 0.045, 0.46, 0.07, trim);
      k.box(x * (W / 2 + 0.13), belt + 0.08, -L / 2 + L * hoodF + 0.16, 0.18, 0.09, 0.13, trim);
    }
    k.box(0, belt + 0.45, -L / 2 + L * hoodF + 0.14, W * 0.86, 0.045, 0.07, trim);
    k.box(0, belt + 0.04, 0.22, W * 0.76, 0.12, L * 0.32, rgb('#7a4b2c'));
  }

  if (s.kind === 'sport' || s.kind === 'hyper') {
    // Carbon rear GT wing with sleek endplates & twin struts
    k.box(0, belt + 0.22, L / 2 - 0.18, W * 0.94, 0.04, 0.32, carbon);
    for (const x of [-1, 1]) {
      k.box(x * W * 0.47, belt + 0.23, L / 2 - 0.18, 0.03, 0.13, 0.34, carbon);
      k.box(x * W * 0.34, belt + 0.1, L / 2 - 0.18, 0.05, 0.2, 0.18, trim);
    }
  }
  if (s.kind === 'hyper') {
    for (const x of [-1, 1]) {
      k.box(x * (W / 2 + 0.025), 0.64, 0.45, 0.08, 0.24, 0.92, carbon);
    }
    for (let f = -2; f <= 2; f++) {
      k.box(f * 0.24, 0.36, L / 2 + 0.08, 0.04, 0.14, 0.16, carbon);
    }
  }
  if (s.kind === 'taxi') {
    k.box(0, s.h + 0.15, -0.1, 0.72, 0.22, 0.3, rgb('#ffd23f', 1.4));
  }

  // Nose-aligned Multi-Element LED Headlamps & Recessed Smoked Rear Lightbar Fascia
  const headY = Math.min(0.7, noseY - 0.04);
  const tailY = Math.min(0.82, belt - 0.08);
  // Full-width recessed dark rear fascia panel framing taillights
  k.box(0, tailY, L / 2 + 0.015, W * 0.9, 0.16, 0.05, trim);
  for (const x of [-1, 1]) {
    // Dark smoked headlamp bezel flush with front nose
    k.box(x * W * 0.33, headY, -L / 2 - 0.01, W * 0.26, 0.11, 0.06, trim);
    // Crisp bright projector lenses & DRL strip
    lamps.box(x * W * 0.33, headY, -L / 2 - 0.028, W * 0.21, 0.065, 0.05, rgb('#f4f9ff', 3.4));
    // Glowing crimson LED tail bar
    lamps.box(x * W * 0.32, tailY, L / 2 + 0.044, W * 0.26, 0.072, 0.036, rgb('#ff1834', 2.8));
  }
  if (s.kind === 'hyper' || s.kind === 'sport') {
    // Full-width glowing signature LED center lightbar
    lamps.box(0, tailY, L / 2 + 0.044, W * 0.62, 0.032, 0.036, rgb('#ff1e42', 2.4));
  }

  // Vice Coast Rear License Plate
  if (!plateMat) {
    plateMat = new THREE.MeshStandardMaterial({
      map: createLicensePlateTex(),
      roughness: 0.4,
      metalness: 0.15,
    });
  }
  const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.24), plateMat);
  plate.position.set(0, 0.56, L / 2 + 0.105);
  g.add(plate);

  const decal = new MeshKit();
  if (police) {
    const dz = model === 'swat' ? 0 : -0.1;
    const dl = model === 'swat' ? L * 0.7 : L * 0.42;
    for (const x of [-1, 1]) {
      decal.box(x * (W / 2 + 0.008), 0.68, dz, 0.02, 0.44, dl, rgb('#101d3b'));
      decal.box(x * (W / 2 + 0.015), 0.92, dz, 0.02, 0.065, L * 0.8, rgb('#00d8c8'));
    }
    decal.box(
      0,
      belt + 0.004,
      -L / 2 + L * hoodF * 0.5,
      W * 0.68,
      0.02,
      L * hoodF * 0.78,
      rgb('#101d3b'),
    );
  }
  if (armored) {
    for (const x of [-1, 1]) {
      decal.box(x * (W / 2 + 0.012), 1.32, 0.2, 0.03, 0.32, L * 0.75, rgb('#ff2e93'));
      decal.box(x * (W / 2 + 0.018), 1.0, 0.2, 0.03, 0.12, L * 0.75, rgb('#00f0d8'));
    }
  }
  if (s.kind === 'taxi') {
    for (const x of [-1, 1]) {
      decal.box(x * (W / 2 + 0.008), 0.72, 0, 0.02, 0.1, L * 0.8, rgb('#111'));
    }
  }
  if (s.kind === 'hyper') {
    decal.box(0, belt + 0.018, -L * 0.2, 0.32, 0.015, L * 0.42, rgb('#00f0d8'));
  }

  add(k.geometry(), darkMat);
  add(lamps.geometry(), lampMat);
  if (decal.pos.length) {
    add(
      decal.geometry(),
      new THREE.MeshStandardMaterial({
        vertexColors: true,
        roughness: 0.28,
        metalness: 0.35,
      }),
    );
  }

  // Photorealistic LatheGeometry Tires + Concave 5-Spoke Alloy Rims + Brake Calipers
  const wheels: THREE.Object3D[] = [];
  for (const z of [-wz, wz]) {
    for (const x of [-1, 1]) {
      const w = buildWheelMesh(x, isSoftwareGl);
      w.position.set(x * (W / 2 - 0.1), 0.38, z);
      w.userData.front = z < 0;
      g.add(w);
      wheels.push(w);
    }
  }

  const glows: THREE.Sprite[] = [];
  for (const x of [-1, 1]) {
    const hg = new THREE.Sprite(sharedGlow());
    hg.material.color.set('#e8f6ff');
    hg.position.set(x * W * 0.33, headY, -L / 2 - 0.3);
    hg.scale.setScalar(1.7);
    g.add(hg);
    glows.push(hg);

    const tg = new THREE.Sprite(sharedGlow());
    tg.material.color.set('#ff1c3c');
    tg.position.set(x * W * 0.32, tailY, L / 2 + 0.25);
    tg.scale.setScalar(1.05);
    g.add(tg);
    glows.push(tg);
  }

  let bar: {
    red: THREE.Mesh;
    blue: THREE.Mesh;
    rg: THREE.Sprite;
    bg: THREE.Sprite;
  } | null = null;
  if (police) {
    const top = s.h + 0.12;
    const bz = -0.1;
    const base = new THREE.Mesh(
      new THREE.BoxGeometry(1.5, 0.08, 0.34),
      new THREE.MeshStandardMaterial({ color: '#1b1e28' }),
    );
    base.position.set(0, top - 0.08, bz);
    g.add(base);
    const red = new THREE.Mesh(
      new THREE.BoxGeometry(0.66, 0.16, 0.3),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(4, 0.2, 0.3), fog: false }),
    );
    const blue = new THREE.Mesh(
      new THREE.BoxGeometry(0.66, 0.16, 0.3),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(0.15, 0.65, 5), fog: false }),
    );
    red.position.set(-0.38, top, bz);
    blue.position.set(0.38, top, bz);
    const rg = new THREE.Sprite(sharedGlow());
    const bg = new THREE.Sprite(sharedGlow());
    rg.material.color.setRGB(1, 0.12, 0.22);
    bg.material.color.setRGB(0.12, 0.42, 1);
    rg.position.copy(red.position);
    bg.position.copy(blue.position);
    rg.scale.setScalar(4.2);
    bg.scale.setScalar(4.2);
    g.add(red, blue, rg, bg);
    bar = { red, blue, rg, bg };
  }

  return { group: g, wheels, glows, bar, paintMat, underglow, underglowMat };
}
