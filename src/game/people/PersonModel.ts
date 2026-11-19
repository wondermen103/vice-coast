// PersonModel: photorealistic anatomical articulated characters (Jason Vance, Lucia Reyes, and Vice Coast NPCs)
// with sculpted LatheGeometry torsos, detailed facial features, denim/linen PBR textures, layered hairstyles,
// subtle idle breathing, smooth damped locomotion, and feathered radial contact shadows.
import * as THREE from 'three';
import {
  createCarShadowTex,
  createDenimTex,
  createFabricBumpTex,
  createLuciaTopTex,
  createResortShirtTex,
} from '../render/Textures.ts';
import type { Rng } from '../core/MathUtil.ts';

export const SKINS = ['#f1c7a5', '#d9a07a', '#b97850', '#8a5636', '#5e3a24', '#e8b48f'];
export const HAIRS = ['#1c1410', '#3b2414', '#6b4423', '#c99a4e', '#111111', '#8a2b1c', '#e6d3a0'];
export const SHIRTS = [
  '#ff4f8b',
  '#19c6c4',
  '#f5c842',
  '#f4f1ea',
  '#4e9460',
  '#ff7c4c',
  '#7c4dbd',
  '#2c7ee0',
  '#e03c52',
  '#f598bc',
];
export const PANTS = ['#23273b', '#383d54', '#c2b285', '#e8e2d5', '#1b3152', '#523a2e', '#444963'];

export interface PersonLook {
  skin: string;
  hair: string;
  shirt: string;
  pants: string;
  shoe?: string;
  shorts?: boolean;
  shades?: boolean;
  longHair?: boolean;
  ponytail?: boolean;
  longSleeve?: boolean;
  cap?: string | null;
  vest?: string | null;
  badge?: boolean;
  tee?: string;
  scale?: number;
  shirtPrint?: boolean;
  luciaStyle?: boolean;
  denim?: boolean;
  earrings?: boolean;
  bodyType?: 'athletic' | 'feminine';
}

export interface PersonRig {
  root: THREE.Group;
  body: THREE.Group;
  hips: THREE.Group;
  chest: THREE.Group;
  head: THREE.Group;
  armL: { top: THREE.Group; mid: THREE.Group };
  armR: { top: THREE.Group; mid: THREE.Group };
  legL: { top: THREE.Group; mid: THREE.Group };
  legR: { top: THREE.Group; mid: THREE.Group };
  gun: THREE.Object3D;
}

// Sculpted athletic male torso profile (hem -> waist -> ribcage -> broad chest -> trapezius -> neck)
function makeAthleticTorso(): THREE.BufferGeometry {
  const pts = [
    new THREE.Vector2(0.154, 0.0),
    new THREE.Vector2(0.15, 0.08),
    new THREE.Vector2(0.16, 0.19),
    new THREE.Vector2(0.184, 0.31),
    new THREE.Vector2(0.192, 0.39),
    new THREE.Vector2(0.168, 0.445),
    new THREE.Vector2(0.102, 0.472),
    new THREE.Vector2(0.066, 0.482),
  ];
  const g = new THREE.LatheGeometry(pts, 22);
  g.computeVertexNormals();
  return g;
}

// Sculpted athletic feminine torso profile (tailored waist -> bust -> graceful collarbones)
function makeFeminineTorso(): THREE.BufferGeometry {
  const pts = [
    new THREE.Vector2(0.148, 0.0),
    new THREE.Vector2(0.128, 0.09),
    new THREE.Vector2(0.136, 0.19),
    new THREE.Vector2(0.166, 0.305),
    new THREE.Vector2(0.162, 0.385),
    new THREE.Vector2(0.146, 0.435),
    new THREE.Vector2(0.092, 0.464),
    new THREE.Vector2(0.058, 0.475),
  ];
  const g = new THREE.LatheGeometry(pts, 22);
  g.computeVertexNormals();
  return g;
}

const GEO = {
  shadow: new THREE.PlaneGeometry(0.96, 0.96),
  pelvis: new THREE.CylinderGeometry(0.156, 0.168, 0.23, 18),
  belt: new THREE.CylinderGeometry(0.162, 0.162, 0.04, 18),
  torsoAthletic: makeAthleticTorso(),
  torsoFeminine: makeFeminineTorso(),
  collar: new THREE.TorusGeometry(0.07, 0.017, 8, 18),
  shoulderCap: new THREE.SphereGeometry(0.065, 14, 10),
  neck: new THREE.CylinderGeometry(0.052, 0.064, 0.125, 16),
  head: new THREE.SphereGeometry(0.115, 22, 18),
  jaw: new THREE.SphereGeometry(0.082, 16, 12),
  brow: new THREE.BoxGeometry(0.036, 0.009, 0.012),
  lips: new THREE.CapsuleGeometry(0.008, 0.026, 4, 8),
  ear: new THREE.SphereGeometry(0.02, 8, 6),
  hoop: new THREE.TorusGeometry(0.017, 0.003, 6, 14),
  nose: new THREE.ConeGeometry(0.018, 0.048, 10),
  eyeWhite: new THREE.SphereGeometry(0.016, 8, 6),
  pupil: new THREE.SphereGeometry(0.009, 8, 6),
  hairCrown: new THREE.SphereGeometry(0.122, 20, 16, 0, Math.PI * 2, 0, Math.PI * 0.65),
  hairNape: new THREE.SphereGeometry(0.118, 18, 14, Math.PI * 0.14, Math.PI * 0.72, Math.PI * 0.34, Math.PI * 0.48),
  hairQuiff: new THREE.SphereGeometry(0.076, 14, 10),
  hairBack: new THREE.CapsuleGeometry(0.092, 0.16, 8, 14),
  ponytail: new THREE.CapsuleGeometry(0.044, 0.22, 8, 12),
  capCrown: new THREE.SphereGeometry(0.125, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.56),
  capBrim: new THREE.CylinderGeometry(0.116, 0.126, 0.016, 12, 1, false, -Math.PI * 0.35, Math.PI * 0.7),
  lens: new THREE.CylinderGeometry(0.036, 0.036, 0.012, 14),
  upperArm: new THREE.CylinderGeometry(0.052, 0.043, 0.275, 14),
  sleeveCuff: new THREE.CylinderGeometry(0.06, 0.054, 0.145, 14),
  forearm: new THREE.CylinderGeometry(0.042, 0.033, 0.255, 14),
  jointArm: new THREE.SphereGeometry(0.043, 10, 8),
  hand: new THREE.CapsuleGeometry(0.027, 0.048, 6, 10),
  thigh: new THREE.CylinderGeometry(0.092, 0.072, 0.43, 16),
  calf: new THREE.CylinderGeometry(0.068, 0.05, 0.43, 16),
  jointKnee: new THREE.SphereGeometry(0.069, 12, 10),
  shoeUpper: new THREE.CapsuleGeometry(0.058, 0.145, 6, 12),
  shoeSole: new THREE.BoxGeometry(0.122, 0.034, 0.275),
};

const matCache = new Map<string, THREE.Material>();

function skinMat(hex: string): THREE.MeshStandardMaterial {
  const key = `skin:${hex}`;
  if (!matCache.has(key)) {
    matCache.set(
      key,
      new THREE.MeshStandardMaterial({
        color: hex,
        roughness: 0.58,
        metalness: 0.02,
      }),
    );
  }
  return matCache.get(key) as THREE.MeshStandardMaterial;
}

function fabricMat(hex: string, roughness = 0.84): THREE.MeshStandardMaterial {
  const key = `fab:${hex}:${roughness}`;
  if (!matCache.has(key)) {
    matCache.set(
      key,
      new THREE.MeshStandardMaterial({
        color: hex,
        bumpMap: createFabricBumpTex(4),
        bumpScale: 0.014,
        roughness,
        metalness: 0.02,
      }),
    );
  }
  return matCache.get(key) as THREE.MeshStandardMaterial;
}

function denimMat(): THREE.MeshStandardMaterial {
  const key = 'denim:indigo';
  if (!matCache.has(key)) {
    matCache.set(
      key,
      new THREE.MeshStandardMaterial({
        color: 0xffffff,
        map: createDenimTex(4),
        bumpMap: createFabricBumpTex(4),
        bumpScale: 0.018,
        roughness: 0.88,
        metalness: 0.02,
      }),
    );
  }
  return matCache.get(key) as THREE.MeshStandardMaterial;
}

function resortShirtMat(): THREE.MeshStandardMaterial {
  const key = 'resort:print';
  if (!matCache.has(key)) {
    matCache.set(
      key,
      new THREE.MeshStandardMaterial({
        color: 0xffffff,
        map: createResortShirtTex(4),
        bumpMap: createFabricBumpTex(4),
        bumpScale: 0.016,
        roughness: 0.8,
        metalness: 0.03,
      }),
    );
  }
  return matCache.get(key) as THREE.MeshStandardMaterial;
}

function luciaTopMat(): THREE.MeshStandardMaterial {
  const key = 'lucia:top';
  if (!matCache.has(key)) {
    matCache.set(
      key,
      new THREE.MeshStandardMaterial({
        color: 0xffffff,
        map: createLuciaTopTex(4),
        bumpMap: createFabricBumpTex(4),
        bumpScale: 0.015,
        roughness: 0.76,
        metalness: 0.04,
      }),
    );
  }
  return matCache.get(key) as THREE.MeshStandardMaterial;
}

function hairMat(hex: string): THREE.MeshStandardMaterial {
  const key = `hair:${hex}`;
  if (!matCache.has(key)) {
    matCache.set(
      key,
      new THREE.MeshStandardMaterial({
        color: hex,
        roughness: 0.46,
        metalness: 0.1,
      }),
    );
  }
  return matCache.get(key) as THREE.MeshStandardMaterial;
}

function solidMat(hex: string, roughness = 0.45, metalness = 0.2): THREE.MeshStandardMaterial {
  const key = `sol:${hex}:${roughness}:${metalness}`;
  if (!matCache.has(key)) {
    matCache.set(key, new THREE.MeshStandardMaterial({ color: hex, roughness, metalness }));
  }
  return matCache.get(key) as THREE.MeshStandardMaterial;
}

let _shadesLensMat: THREE.MeshPhysicalMaterial | null = null;
function getShadesLensMat(): THREE.MeshPhysicalMaterial {
  if (!_shadesLensMat) {
    _shadesLensMat = new THREE.MeshPhysicalMaterial({
      color: '#0a1220',
      roughness: 0.04,
      metalness: 0.9,
      clearcoat: 1.0,
    });
  }
  return _shadesLensMat;
}

let _shadowMat: THREE.MeshBasicMaterial | null = null;
function getShadowMat(): THREE.MeshBasicMaterial {
  if (!_shadowMat) {
    _shadowMat = new THREE.MeshBasicMaterial({
      map: createCarShadowTex(),
      transparent: true,
      opacity: 0.56,
      depthWrite: false,
    });
  }
  return _shadowMat;
}

function makeMesh(
  geo: THREE.BufferGeometry,
  mat: THREE.Material,
  shadow: boolean,
): THREE.Mesh {
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = shadow;
  m.receiveShadow = shadow;
  return m;
}

export function buildPerson(look: PersonLook, isSoftwareGl = false): PersonRig {
  const shadow = !isSoftwareGl;
  const fem = look.bodyType === 'feminine';
  const mSkin = skinMat(look.skin);
  const mShirt = look.luciaStyle
    ? luciaTopMat()
    : look.shirtPrint
      ? resortShirtMat()
      : fabricMat(look.shirt, 0.82);
  const mPants = look.denim ? denimMat() : fabricMat(look.pants, 0.86);
  const mHair = hairMat(look.hair);
  const mShoe = solidMat(look.shoe || '#22242c', 0.46, 0.08);
  const mWhite = solidMat('#f3f1ec', 0.56, 0.04);
  const mGold = solidMat('#ebc562', 0.22, 0.88);
  const mBelt = solidMat('#231d19', 0.46, 0.12);
  const mLips = solidMat(fem ? '#b55666' : '#9c6352', 0.54, 0.04);

  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);

  // Feathered radial contact shadow disc
  const disc = new THREE.Mesh(GEO.shadow, getShadowMat());
  disc.rotation.x = -Math.PI / 2;
  disc.position.y = 0.025;
  root.add(disc);

  const s = look.scale || (fem ? 0.96 : 1.0);
  body.scale.setScalar(s);

  // Hips / Pelvis with fitted belt & metallic buckle
  const hips = new THREE.Group();
  hips.position.y = 0.95;
  body.add(hips);

  const pelvis = makeMesh(GEO.pelvis, mPants, shadow);
  pelvis.scale.set(fem ? 1.04 : 1.06, 1.0, fem ? 0.76 : 0.72);
  pelvis.position.y = 0.04;
  hips.add(pelvis);

  const belt = makeMesh(GEO.belt, mBelt, shadow);
  belt.scale.set(fem ? 1.0 : 1.08, 1.0, fem ? 0.74 : 0.75);
  belt.position.y = 0.135;
  hips.add(belt);

  const buckle = makeMesh(new THREE.BoxGeometry(0.056, 0.042, 0.022), mGold, shadow);
  buckle.position.set(0, 0.135, -0.12);
  hips.add(buckle);

  // Sculpted Anatomical Torso / Chest
  const chest = new THREE.Group();
  chest.position.y = 0.13;
  hips.add(chest);

  const torso = makeMesh(fem ? GEO.torsoFeminine : GEO.torsoAthletic, mShirt, shadow);
  torso.scale.set(fem ? 1.02 : 1.06, 1.0, fem ? 0.74 : 0.68);
  torso.position.y = 0.0;
  chest.add(torso);

  if (!look.luciaStyle) {
    // Folded shirt collar around neck base
    const collar = makeMesh(GEO.collar, mShirt, shadow);
    collar.rotation.x = Math.PI / 2;
    collar.position.set(0, 0.47, 0.008);
    chest.add(collar);
  } else {
    // Lucia's sculpted gold pendant necklace
    const chain = makeMesh(new THREE.TorusGeometry(0.062, 0.0055, 6, 16, Math.PI), mGold, false);
    chain.rotation.x = Math.PI * 0.64;
    chain.position.set(0, 0.445, -0.072);
    chest.add(chain);
  }

  // Natural blended deltoid transitions
  const shX = fem ? 0.156 : 0.182;
  for (const side of [-1, 1]) {
    const sh = makeMesh(GEO.shoulderCap, look.luciaStyle ? mSkin : mShirt, shadow);
    sh.scale.set(fem ? 0.8 : 0.94, fem ? 0.85 : 1.02, fem ? 0.82 : 0.9);
    sh.position.set(side * shX, 0.395, 0);
    chest.add(sh);
  }

  // Open-collar resort shirt V-opening revealing ribbed tee + gold chain
  if (look.tee) {
    const mTee = fabricMat(look.tee, 0.88);
    const tee = makeMesh(new THREE.CylinderGeometry(0.086, 0.072, 0.4, 12, 1, false, -0.7, 1.4), mTee, shadow);
    tee.rotation.y = Math.PI;
    tee.scale.set(1.14, 1, 0.92);
    tee.position.set(0, 0.245, -0.055);
    chest.add(tee);

    for (const side of [-1, 1]) {
      const lapel = makeMesh(new THREE.BoxGeometry(0.05, 0.115, 0.022), mShirt, shadow);
      lapel.position.set(side * 0.062, 0.405, -0.11);
      lapel.rotation.z = side * -0.34;
      chest.add(lapel);
    }

    const chain = makeMesh(new THREE.TorusGeometry(0.064, 0.0065, 6, 14, Math.PI), mGold, false);
    chain.rotation.x = Math.PI * 0.62;
    chain.position.set(0, 0.438, -0.084);
    chest.add(chain);
  }

  // Police/SWAT tactical vest & metallic badge
  if (look.vest) {
    const mVest = fabricMat(look.vest, 0.72);
    const vest = makeMesh(GEO.torsoAthletic, mVest, shadow);
    vest.scale.set(1.12, 0.82, 0.78);
    vest.position.y = 0.04;
    chest.add(vest);
  }
  if (look.badge) {
    const badge = makeMesh(new THREE.CylinderGeometry(0.026, 0.026, 0.012, 8), mGold, false);
    badge.rotation.x = Math.PI / 2;
    badge.position.set(-0.095, 0.34, -0.132);
    chest.add(badge);
  }

  // Neck
  const neck = makeMesh(GEO.neck, mSkin, shadow);
  neck.scale.set(fem ? 0.86 : 1, 1, fem ? 0.86 : 1);
  neck.position.y = 0.495;
  chest.add(neck);

  // Sculpted Anatomical Head with Facial Contours
  const head = new THREE.Group();
  head.position.y = 0.642;
  chest.add(head);

  const cranium = makeMesh(GEO.head, mSkin, shadow);
  cranium.scale.set(fem ? 0.88 : 0.92, 1.09, 0.99);
  head.add(cranium);

  const jaw = makeMesh(GEO.jaw, mSkin, shadow);
  jaw.scale.set(fem ? 0.84 : 0.92, 0.82, 0.95);
  jaw.position.set(0, -0.056, -0.022);
  head.add(jaw);

  // Lips
  const lips = makeMesh(GEO.lips, mLips, false);
  lips.rotation.z = Math.PI / 2;
  lips.position.set(0, -0.052, -0.104);
  head.add(lips);

  // Ears + optional gold hoop earrings
  for (const side of [-1, 1]) {
    const ear = makeMesh(GEO.ear, mSkin, shadow);
    ear.scale.set(0.54, 1.24, 0.84);
    ear.position.set(side * (fem ? 0.1 : 0.105), -0.005, 0.006);
    head.add(ear);
    if (look.earrings) {
      const hoop = makeMesh(GEO.hoop, mGold, false);
      hoop.rotation.y = Math.PI / 2;
      hoop.position.set(side * 0.104, -0.032, 0.004);
      head.add(hoop);
    }
  }

  // Sculpted nose
  const nose = makeMesh(GEO.nose, mSkin, shadow);
  nose.rotation.x = -Math.PI * 0.42;
  nose.position.set(0, -0.008, -0.11);
  head.add(nose);

  // Hair or Cap
  if (look.cap) {
    const mCap = fabricMat(look.cap, 0.78);
    const crown = makeMesh(GEO.capCrown, mCap, shadow);
    crown.scale.set(0.95, 1.04, 1.05);
    crown.position.set(0, 0.025, 0.005);
    head.add(crown);

    const brim = makeMesh(GEO.capBrim, mCap, shadow);
    brim.rotation.y = Math.PI;
    brim.rotation.x = 0.14;
    brim.position.set(0, 0.048, -0.088);
    head.add(brim);
  } else {
    const hCrown = makeMesh(GEO.hairCrown, mHair, shadow);
    hCrown.scale.set(fem ? 0.94 : 0.95, 1.08, 1.05);
    hCrown.position.set(0, 0.012, 0.006);
    head.add(hCrown);

    // Tapered back-of-head hair covering occipital skull cleanly
    const nape = makeMesh(GEO.hairNape, mHair, shadow);
    nape.scale.set(fem ? 0.94 : 0.94, 1.06, 1.03);
    nape.position.set(0, -0.002, 0.008);
    head.add(nape);

    const quiff = makeMesh(GEO.hairQuiff, mHair, shadow);
    quiff.scale.set(1.06, 0.46, 0.94);
    quiff.position.set(0.006, 0.096, -0.03);
    quiff.rotation.x = -0.18;
    head.add(quiff);

    if (look.ponytail) {
      // Lucia's signature high-volume swept ponytail
      const pony = makeMesh(GEO.ponytail, mHair, shadow);
      pony.position.set(0, -0.06, 0.135);
      pony.rotation.x = 0.34;
      head.add(pony);
    } else if (look.longHair) {
      const back = makeMesh(GEO.hairBack, mHair, shadow);
      back.scale.set(1.1, 1.08, 0.74);
      back.position.set(0, -0.055, 0.072);
      head.add(back);
    }
  }

  // Reflective Aviator Sunglasses or Expressive Eyes
  if (look.shades) {
    const lensMat = getShadesLensMat();
    for (const side of [-1, 1]) {
      const lens = makeMesh(GEO.lens, lensMat, false);
      lens.rotation.x = Math.PI / 2;
      lens.scale.set(1.16, 1, 0.9);
      lens.position.set(side * 0.045, 0.016, -0.105);
      head.add(lens);

      const arm = makeMesh(new THREE.BoxGeometry(0.007, 0.007, 0.11), mGold, false);
      arm.position.set(side * 0.094, 0.022, -0.052);
      head.add(arm);
    }
    const bridge = makeMesh(new THREE.BoxGeometry(0.04, 0.009, 0.009), mGold, false);
    bridge.position.set(0, 0.026, -0.107);
    head.add(bridge);
  } else {
    const mPupil = solidMat('#1a1715', 0.18, 0.12);
    for (const side of [-1, 1]) {
      const ew = makeMesh(GEO.eyeWhite, mWhite, false);
      ew.position.set(side * 0.037, 0.018, -0.097);
      head.add(ew);
      const pu = makeMesh(GEO.pupil, mPupil, false);
      pu.position.set(side * 0.037, 0.018, -0.109);
      head.add(pu);
      const brow = makeMesh(GEO.brow, mHair, false);
      brow.position.set(side * 0.038, 0.042, -0.102);
      head.add(brow);
    }
  }

  // Smooth Articulated Limbs Helper
  const armX = fem ? 0.186 : 0.21;
  const buildArm = (side: -1 | 1) => {
    const top = new THREE.Group();
    top.position.set(side * armX, 0.394, 0);
    chest.add(top);

    const upperMat = look.longSleeve ? mShirt : mSkin;
    const upper = makeMesh(GEO.upperArm, upperMat, shadow);
    if (fem) upper.scale.set(0.84, 1, 0.84);
    upper.position.y = -0.138;
    top.add(upper);

    if (!look.longSleeve && !look.luciaStyle) {
      const cuff = makeMesh(GEO.sleeveCuff, mShirt, shadow);
      cuff.position.y = -0.066;
      top.add(cuff);
    }

    const elbow = makeMesh(GEO.jointArm, upperMat, shadow);
    if (fem) elbow.scale.setScalar(0.84);
    elbow.position.y = -0.275;
    top.add(elbow);

    const mid = new THREE.Group();
    mid.position.y = -0.275;
    top.add(mid);

    const lowerMat = look.longSleeve ? mShirt : mSkin;
    const fore = makeMesh(GEO.forearm, lowerMat, shadow);
    if (fem) fore.scale.set(0.84, 1, 0.84);
    fore.position.y = -0.128;
    mid.add(fore);

    if ((look.shirtPrint || look.luciaStyle) && side === -1) {
      const watch = makeMesh(new THREE.CylinderGeometry(0.038, 0.038, 0.02, 12), mGold, false);
      watch.position.y = -0.228;
      mid.add(watch);
    }

    const hand = makeMesh(GEO.hand, mSkin, shadow);
    hand.scale.set(fem ? 0.84 : 0.94, 1.0, 0.74);
    hand.position.set(0, -0.276, -0.008);
    mid.add(hand);

    return { top, mid };
  };

  const buildLeg = (side: -1 | 1) => {
    const top = new THREE.Group();
    top.position.set(side * (fem ? 0.088 : 0.092), -0.01, 0);
    hips.add(top);

    const thigh = makeMesh(GEO.thigh, mPants, shadow);
    if (fem) thigh.scale.set(0.96, 1, 0.98);
    thigh.position.y = -0.215;
    top.add(thigh);

    const kneeMat = look.shorts ? mSkin : mPants;
    const knee = makeMesh(GEO.jointKnee, kneeMat, shadow);
    if (fem) knee.scale.setScalar(0.92);
    knee.position.y = -0.43;
    top.add(knee);

    const mid = new THREE.Group();
    mid.position.y = -0.43;
    top.add(mid);

    const calf = makeMesh(GEO.calf, kneeMat, shadow);
    if (fem) calf.scale.set(0.9, 1, 0.92);
    calf.position.y = -0.215;
    mid.add(calf);

    // Contoured sneaker with white midsole
    const shoeUpper = makeMesh(GEO.shoeUpper, mShoe, shadow);
    shoeUpper.rotation.x = Math.PI / 2;
    shoeUpper.scale.set(fem ? 0.92 : 1.0, 1.0, 0.72);
    shoeUpper.position.set(0, -0.452, -0.042);
    mid.add(shoeUpper);

    const shoeSole = makeMesh(GEO.shoeSole, mWhite, shadow);
    if (fem) shoeSole.scale.set(0.92, 0.92, 0.95);
    shoeSole.position.set(0, -0.482, -0.042);
    mid.add(shoeSole);

    return { top, mid };
  };

  const armL = buildArm(-1);
  const armR = buildArm(1);
  const legL = buildLeg(-1);
  const legR = buildLeg(1);

  // Detailed Compact 9mm Sidearm
  const gun = new THREE.Group();
  const mGun = solidMat('#1b1f27', 0.32, 0.78);
  const mGrip = solidMat('#121418', 0.78, 0.12);
  const slide = makeMesh(new THREE.BoxGeometry(0.034, 0.05, 0.21), mGun, shadow);
  slide.position.set(0, -0.295, -0.088);
  const grip = makeMesh(new THREE.BoxGeometry(0.03, 0.102, 0.046), mGrip, shadow);
  grip.position.set(0, -0.355, -0.018);
  grip.rotation.x = 0.18;
  gun.add(slide, grip);
  gun.visible = false;
  armR.mid.add(gun);

  return { root, body, hips, chest, head, armL, armR, legL, legR, gun };
}

export function animatePerson(
  r: PersonRig,
  phase: number,
  mode: 'idle' | 'walk' | 'run' | 'dead' | 'drive',
  aim: boolean,
  dt: number,
  idleTime = 0,
): void {
  if (mode === 'dead') {
    r.body.rotation.x = THREE.MathUtils.lerp(r.body.rotation.x, -Math.PI / 2, Math.min(1, dt * 6));
    r.body.position.y = THREE.MathUtils.lerp(r.body.position.y, 0.12, Math.min(1, dt * 6));
    r.armL.top.rotation.z = -1.2;
    r.armR.top.rotation.z = 1.2;
    r.legL.top.rotation.x = 0.1;
    r.legR.top.rotation.x = -0.15;
    return;
  }
  r.body.rotation.x = 0;
  r.body.position.y = 0;
  if (mode === 'drive') {
    r.body.position.y = -0.42;
    r.legL.top.rotation.x = r.legR.top.rotation.x = 1.45;
    r.legL.mid.rotation.x = r.legR.mid.rotation.x = -1.25;
    r.armL.top.rotation.x = r.armR.top.rotation.x = 1.05;
    r.armL.mid.rotation.x = r.armR.mid.rotation.x = 0.35;
    r.armL.top.rotation.z = -0.12;
    r.armR.top.rotation.z = 0.12;
    return;
  }
  const amp = mode === 'run' ? 0.9 : mode === 'walk' ? 0.48 : 0;
  const sn = Math.sin(phase);
  const cs = Math.cos(phase);
  const breath = Math.sin(idleTime * 2.1);
  const k = Math.min(1, dt * 14);

  const targetLegL = sn * amp;
  const targetLegR = -sn * amp;
  const targetKneeL = -Math.max(0, -cs) * amp * 1.26 - (amp ? 0.05 : 0.02);
  const targetKneeR = -Math.max(0, cs) * amp * 1.26 - (amp ? 0.05 : 0.02);
  const targetArmL = -sn * amp * 0.78;
  const targetArmR = sn * amp * 0.78;

  r.legL.top.rotation.x = THREE.MathUtils.lerp(r.legL.top.rotation.x, targetLegL, k);
  r.legR.top.rotation.x = THREE.MathUtils.lerp(r.legR.top.rotation.x, targetLegR, k);
  r.legL.mid.rotation.x = THREE.MathUtils.lerp(r.legL.mid.rotation.x, targetKneeL, k);
  r.legR.mid.rotation.x = THREE.MathUtils.lerp(r.legR.mid.rotation.x, targetKneeR, k);

  r.armL.top.rotation.x = THREE.MathUtils.lerp(r.armL.top.rotation.x, targetArmL, k);
  r.armL.mid.rotation.x = THREE.MathUtils.lerp(r.armL.mid.rotation.x, 0.18 + amp * 0.46, k);
  r.armL.top.rotation.z = THREE.MathUtils.lerp(r.armL.top.rotation.z, -0.065 - breath * 0.01, k);
  r.armR.top.rotation.x = THREE.MathUtils.lerp(r.armR.top.rotation.x, targetArmR, k);
  r.armR.mid.rotation.x = THREE.MathUtils.lerp(r.armR.mid.rotation.x, 0.18 + amp * 0.46, k);
  r.armR.top.rotation.z = THREE.MathUtils.lerp(r.armR.top.rotation.z, 0.065 + breath * 0.01, k);

  r.hips.position.y = 0.95 + Math.abs(cs) * amp * 0.05 + (amp === 0 ? breath * 0.006 : 0);
  r.chest.rotation.x = THREE.MathUtils.lerp(
    r.chest.rotation.x,
    mode === 'run' ? 0.15 : amp === 0 ? 0.015 + breath * 0.012 : 0.04,
    k,
  );
  r.chest.rotation.y = THREE.MathUtils.lerp(
    r.chest.rotation.y,
    amp > 0 ? sn * amp * 0.11 : Math.sin(idleTime * 0.7) * 0.03,
    k,
  );
  r.head.rotation.y = THREE.MathUtils.lerp(
    r.head.rotation.y,
    amp === 0 ? Math.sin(idleTime * 0.55) * 0.08 : 0,
    k * 0.6,
  );

  if (aim) {
    r.armR.top.rotation.set(Math.PI / 2 - r.chest.rotation.x, 0, 0);
    r.armR.mid.rotation.x = 0;
    r.armL.top.rotation.set(Math.PI / 2.4, 0, 0.5);
    r.armL.mid.rotation.x = 0.3;
    r.chest.rotation.y = 0;
    r.head.rotation.y = 0;
  }
  r.gun.visible = !!aim;
}

export function randomLook(rng: Rng, extra: Partial<PersonLook> = {}): PersonLook {
  const fem = rng.chance(0.45);
  return {
    skin: rng.pick(SKINS),
    hair: rng.pick(HAIRS),
    shirt: rng.pick(SHIRTS),
    pants: rng.pick(PANTS),
    shorts: rng.chance(0.32),
    denim: rng.chance(0.45),
    shades: rng.chance(0.35),
    longHair: fem && rng.chance(0.55),
    ponytail: fem && rng.chance(0.35),
    earrings: fem && rng.chance(0.4),
    bodyType: fem ? 'feminine' : 'athletic',
    cap: !fem && rng.chance(0.16) ? rng.pick(SHIRTS) : null,
    scale: rng.range(0.94, 1.04),
    shoe: rng.pick(['#20222a', '#f2f0ea', '#704426', '#1c4f7a']),
    ...extra,
  };
}

export const JASON_LOOK: PersonLook = {
  skin: '#c48f6a',
  hair: '#1c1510',
  shirt: '#15b8c2',
  tee: '#f4f2ee',
  pants: '#232c44',
  shoe: '#f4f2ec',
  shades: true,
  shirtPrint: true,
  denim: true,
  bodyType: 'athletic',
  scale: 1.02,
};

export const LUCIA_LOOK: PersonLook = {
  skin: '#be8360',
  hair: '#160f0d',
  shirt: '#ff3c85',
  pants: '#1d2230',
  shoe: '#f4f2ec',
  shades: false,
  luciaStyle: true,
  denim: true,
  ponytail: true,
  earrings: true,
  bodyType: 'feminine',
  scale: 0.97,
};

export const COP_LOOK: PersonLook = {
  skin: '#d9a07a',
  hair: '#1c1410',
  shirt: '#1d3257',
  pants: '#132038',
  shoe: '#141414',
  cap: '#132038',
  badge: true,
  shades: true,
};

export const SWAT_LOOK: PersonLook = {
  skin: '#b97850',
  hair: '#111111',
  shirt: '#171d29',
  pants: '#141820',
  shoe: '#111111',
  cap: '#171d29',
  vest: '#2b3447',
  longSleeve: true,
  shades: true,
  scale: 1.06,
};

export const GANG_LOOK: PersonLook = {
  skin: '#c48d67',
  hair: '#1c1410',
  shirt: '#8b2339',
  tee: '#16161c',
  pants: '#1e212b',
  shoe: '#f0ece1',
  shades: true,
  scale: 1.02,
};
