// Textures: rich procedural PBR CanvasTexture library (albedo + bump + roughness), neon signs, and art-deco billboards.
import * as THREE from 'three';

function makeCanvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  return [c, ctx];
}

function finalizeTex(
  canvas: HTMLCanvasElement,
  aniso: number,
  isColor: boolean,
  repeat = true,
): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  if (isColor) tex.colorSpace = THREE.SRGBColorSpace;
  if (repeat) {
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
  }
  tex.anisotropy = Math.max(1, aniso);
  tex.needsUpdate = true;
  return tex;
}

function hash2(x: number, y: number): number {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123;
  return s - Math.floor(s);
}

export interface PBRTextureSet {
  map: THREE.CanvasTexture;
  bumpMap: THREE.CanvasTexture;
  roughnessMap?: THREE.CanvasTexture;
}

// 1. Weathered Coastal Asphalt (aggregate speckle, tar seams, subtle oil patches)
export function createAsphaltSet(aniso: number): PBRTextureSet {
  const S = 512;
  const [cCol, gCol] = makeCanvas(S, S);
  const [cBmp, gBmp] = makeCanvas(S, S);
  const [cRgh, gRgh] = makeCanvas(S, S);

  gCol.fillStyle = '#333640';
  gCol.fillRect(0, 0, S, S);
  gBmp.fillStyle = '#808080';
  gBmp.fillRect(0, 0, S, S);
  gRgh.fillStyle = '#c8c8c8';
  gRgh.fillRect(0, 0, S, S);

  // Broad weathered tone patches & puddle roughness pockets
  for (let i = 0; i < 42; i++) {
    const x = hash2(i, 1) * S;
    const y = hash2(i, 2) * S;
    const rad = 26 + hash2(i, 3) * 70;
    const dark = hash2(i, 4) > 0.5;
    const grad = gCol.createRadialGradient(x, y, 2, x, y, rad);
    grad.addColorStop(0, dark ? 'rgba(20,22,28,0.22)' : 'rgba(72,76,88,0.16)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    gCol.fillStyle = grad;
    gCol.fillRect(0, 0, S, S);

    const rGrad = gRgh.createRadialGradient(x, y, 2, x, y, rad);
    rGrad.addColorStop(0, dark ? 'rgba(70,70,70,0.45)' : 'rgba(235,235,235,0.35)');
    rGrad.addColorStop(1, 'rgba(180,180,180,0)');
    gRgh.fillStyle = rGrad;
    gRgh.fillRect(0, 0, S, S);
  }

  // Fine mineral aggregate grit
  for (let i = 0; i < 6500; i++) {
    const x = hash2(i, 11) * S;
    const y = hash2(i, 17) * S;
    const v = 38 + Math.floor(hash2(i, 23) * 44);
    const sz = hash2(i, 29) > 0.85 ? 2.2 : 1.3;
    gCol.fillStyle = `rgb(${v},${v + 1},${v + 5})`;
    gCol.fillRect(x, y, sz, sz);
    const bv = 95 + Math.floor(hash2(i, 31) * 75);
    gBmp.fillStyle = `rgb(${bv},${bv},${bv})`;
    gBmp.fillRect(x, y, sz, sz);
  }

  // Subtle sealed tar cracks (tile-friendly curves)
  gCol.strokeStyle = 'rgba(15,17,22,0.55)';
  gBmp.strokeStyle = 'rgba(42,42,42,0.7)';
  gRgh.strokeStyle = 'rgba(65,65,65,0.6)';
  for (let k = 0; k < 5; k++) {
    let x = hash2(k, 41) * S;
    let y = hash2(k, 43) * S;
    gCol.lineWidth = 1.6;
    gBmp.lineWidth = 2.0;
    gRgh.lineWidth = 2.4;
    for (const ctx of [gCol, gBmp, gRgh]) {
      ctx.beginPath();
      ctx.moveTo(x, y);
    }
    for (let s = 0; s < 10; s++) {
      x += (hash2(k * 13 + s, 53) - 0.5) * 34;
      y += 14 + hash2(k * 13 + s, 59) * 24;
      for (const ctx of [gCol, gBmp, gRgh]) ctx.lineTo(x, y);
    }
    for (const ctx of [gCol, gBmp, gRgh]) ctx.stroke();
  }

  return {
    map: finalizeTex(cCol, aniso, true),
    bumpMap: finalizeTex(cBmp, aniso, false),
    roughnessMap: finalizeTex(cRgh, aniso, false),
  };
}

// 2. Art Deco Promenade & Coral-Stone Pavers (sidewalks, plazas, Malecón)
export function createPromenadeSet(aniso: number): PBRTextureSet {
  const S = 256;
  const [cCol, gCol] = makeCanvas(S, S);
  const [cBmp, gBmp] = makeCanvas(S, S);

  gCol.fillStyle = '#ddd3c4';
  gCol.fillRect(0, 0, S, S);
  gBmp.fillStyle = '#a0a0a0';
  gBmp.fillRect(0, 0, S, S);

  const tiles = 4;
  const step = S / tiles;
  for (let gx = 0; gx < tiles; gx++) {
    for (let gy = 0; gy < tiles; gy++) {
      const shade = 216 + Math.floor((hash2(gx * 7 + gy, 9) - 0.5) * 26);
      const warm = (gx + gy) % 2 === 0 ? 10 : -4;
      gCol.fillStyle = `rgb(${shade + warm}, ${shade + Math.floor(warm * 0.4)}, ${shade - 10})`;
      gCol.fillRect(gx * step + 2, gy * step + 2, step - 4, step - 4);

      const bv = 155 + Math.floor((hash2(gx, gy) - 0.5) * 30);
      gBmp.fillStyle = `rgb(${bv},${bv},${bv})`;
      gBmp.fillRect(gx * step + 2, gy * step + 2, step - 4, step - 4);
    }
  }

  // Grout lines & subtle stone grain
  gCol.strokeStyle = 'rgba(110,98,84,0.45)';
  gCol.lineWidth = 2.5;
  gBmp.strokeStyle = '#383838';
  gBmp.lineWidth = 3;
  for (let i = 0; i <= tiles; i++) {
    const p = i * step;
    for (const ctx of [gCol, gBmp]) {
      ctx.beginPath();
      ctx.moveTo(p, 0);
      ctx.lineTo(p, S);
      ctx.moveTo(0, p);
      ctx.lineTo(S, p);
      ctx.stroke();
    }
  }
  for (let i = 0; i < 1600; i++) {
    const x = hash2(i, 71) * S;
    const y = hash2(i, 73) * S;
    gCol.fillStyle = hash2(i, 79) > 0.5 ? 'rgba(255,255,255,0.12)' : 'rgba(90,75,60,0.12)';
    gCol.fillRect(x, y, 2, 2);
  }

  return {
    map: finalizeTex(cCol, aniso, true),
    bumpMap: finalizeTex(cBmp, aniso, false),
  };
}

// 3. Wind-Rippled Playa Celeste Sand
export function createSandSet(aniso: number): PBRTextureSet {
  const S = 256;
  const [cCol, gCol] = makeCanvas(S, S);
  const [cBmp, gBmp] = makeCanvas(S, S);

  gCol.fillStyle = '#ead09e';
  gCol.fillRect(0, 0, S, S);
  gBmp.fillStyle = '#808080';
  gBmp.fillRect(0, 0, S, S);

  for (let y = 0; y < S; y += 2) {
    const wave = Math.sin((y / S) * Math.PI * 16) * 0.5 + 0.5;
    const r = Math.floor(225 + wave * 20);
    const g = Math.floor(198 + wave * 18);
    const b = Math.floor(148 + wave * 16);
    gCol.fillStyle = `rgb(${r},${g},${b})`;
    gCol.fillRect(0, y, S, 2);
    const bv = Math.floor(105 + wave * 55);
    gBmp.fillStyle = `rgb(${bv},${bv},${bv})`;
    gBmp.fillRect(0, y, S, 2);
  }

  for (let i = 0; i < 2400; i++) {
    const x = hash2(i, 83) * S;
    const y = hash2(i, 89) * S;
    gCol.fillStyle = hash2(i, 97) > 0.5 ? 'rgba(255,248,225,0.22)' : 'rgba(160,126,76,0.18)';
    gCol.fillRect(x, y, 1.5, 1.5);
  }

  return {
    map: finalizeTex(cCol, aniso, true),
    bumpMap: finalizeTex(cBmp, aniso, false),
  };
}

// 4. Art Deco Fluted Coastal Stucco (tinted cleanly by vertexColors)
export function createStuccoSet(aniso: number): PBRTextureSet {
  const S = 256;
  const [cCol, gCol] = makeCanvas(S, S);
  const [cBmp, gBmp] = makeCanvas(S, S);

  gCol.fillStyle = '#f2efe9';
  gCol.fillRect(0, 0, S, S);
  gBmp.fillStyle = '#8c8c8c';
  gBmp.fillRect(0, 0, S, S);

  // Subtle vertical Art-Deco fluting + horizontal floor band seams
  for (let x = 0; x < S; x += 16) {
    gCol.fillStyle = 'rgba(0,0,0,0.035)';
    gCol.fillRect(x, 0, 4, S);
    gBmp.fillStyle = 'rgba(65,65,65,0.45)';
    gBmp.fillRect(x, 0, 3, S);
    gBmp.fillStyle = 'rgba(205,205,205,0.35)';
    gBmp.fillRect(x + 4, 0, 2, S);
  }
  for (let y = 0; y < S; y += 64) {
    gCol.fillStyle = 'rgba(255,255,255,0.24)';
    gCol.fillRect(0, y, S, 4);
    gCol.fillStyle = 'rgba(40,32,26,0.12)';
    gCol.fillRect(0, y + 4, S, 3);
    gBmp.fillStyle = '#d8d8d8';
    gBmp.fillRect(0, y, S, 4);
    gBmp.fillStyle = '#404040';
    gBmp.fillRect(0, y + 4, S, 3);
  }
  // Fine plaster stipple
  for (let i = 0; i < 3200; i++) {
    const x = hash2(i, 101) * S;
    const y = hash2(i, 103) * S;
    const v = 228 + Math.floor((hash2(i, 107) - 0.5) * 28);
    gCol.fillStyle = `rgba(${v},${v - 2},${v - 5},0.35)`;
    gCol.fillRect(x, y, 2, 2);
    const bv = 110 + Math.floor(hash2(i, 109) * 50);
    gBmp.fillStyle = `rgb(${bv},${bv},${bv})`;
    gBmp.fillRect(x, y, 2, 2);
  }

  return {
    map: finalizeTex(cCol, aniso, true),
    bumpMap: finalizeTex(cBmp, aniso, false),
  };
}

// 5. Downtown Curtain-Wall Architectural Mullions & Brushed Aluminium Spandrels
export function createCurtainGlassSet(aniso: number): PBRTextureSet {
  const S = 256;
  const [cCol, gCol] = makeCanvas(S, S);
  const [cBmp, gBmp] = makeCanvas(S, S);

  gCol.fillStyle = '#dbe6ef';
  gCol.fillRect(0, 0, S, S);
  gBmp.fillStyle = '#707070';
  gBmp.fillRect(0, 0, S, S);

  // Subtle spandrel panels & crisp aluminium mullions
  for (let gx = 0; gx < 4; gx++) {
    for (let gy = 0; gy < 4; gy++) {
      const tint = 215 + Math.floor(hash2(gx * 5 + gy, 113) * 28);
      gCol.fillStyle = `rgb(${tint - 8},${tint},${tint + 12})`;
      gCol.fillRect(gx * 64 + 3, gy * 64 + 4, 58, 56);
    }
  }
  gCol.strokeStyle = 'rgba(42,54,68,0.45)';
  gCol.lineWidth = 4;
  gBmp.strokeStyle = '#e5e5e5';
  gBmp.lineWidth = 5;
  for (let i = 0; i <= 4; i++) {
    const p = i * 64;
    for (const ctx of [gCol, gBmp]) {
      ctx.beginPath();
      ctx.moveTo(p, 0);
      ctx.lineTo(p, S);
      ctx.moveTo(0, p);
      ctx.lineTo(S, p);
      ctx.stroke();
    }
  }

  return {
    map: finalizeTex(cCol, aniso, true),
    bumpMap: finalizeTex(cBmp, aniso, false),
  };
}

// 6. Corrugated Industrial Metal & Port Masonry
export function createCorrugatedSet(aniso: number): PBRTextureSet {
  const S = 256;
  const [cCol, gCol] = makeCanvas(S, S);
  const [cBmp, gBmp] = makeCanvas(S, S);

  for (let x = 0; x < S; x++) {
    const rib = Math.sin((x / S) * Math.PI * 32) * 0.5 + 0.5;
    const c = Math.floor(195 + rib * 48);
    gCol.fillStyle = `rgb(${c},${c},${c})`;
    gCol.fillRect(x, 0, 1, S);
    const b = Math.floor(60 + rib * 165);
    gBmp.fillStyle = `rgb(${b},${b},${b})`;
    gBmp.fillRect(x, 0, 1, S);
  }
  // Horizontal riveted seam lines
  gCol.fillStyle = 'rgba(30,28,26,0.22)';
  gCol.fillRect(0, 126, S, 4);
  gBmp.fillStyle = '#303030';
  gBmp.fillRect(0, 126, S, 4);

  return {
    map: finalizeTex(cCol, aniso, true),
    bumpMap: finalizeTex(cBmp, aniso, false),
  };
}

// 7. Sunlit Timber Planks (Faro Celeste Pier & boardwalk accents)
export function createWoodPlankSet(aniso: number): PBRTextureSet {
  const S = 256;
  const [cCol, gCol] = makeCanvas(S, S);
  const [cBmp, gBmp] = makeCanvas(S, S);

  const planks = 8;
  const h = S / planks;
  for (let i = 0; i < planks; i++) {
    const tone = 165 + Math.floor((hash2(i, 127) - 0.5) * 34);
    gCol.fillStyle = `rgb(${tone},${Math.floor(tone * 0.76)},${Math.floor(tone * 0.54)})`;
    gCol.fillRect(0, i * h, S, h - 2);
    gCol.fillStyle = '#3d2c1e';
    gCol.fillRect(0, (i + 1) * h - 2, S, 2);

    gBmp.fillStyle = `rgb(${150 + (i % 2) * 18},${150 + (i % 2) * 18},${150 + (i % 2) * 18})`;
    gBmp.fillRect(0, i * h, S, h - 2);
    gBmp.fillStyle = '#262626';
    gBmp.fillRect(0, (i + 1) * h - 2, S, 2);

    // Wood grain streaks
    for (let s = 0; s < 14; s++) {
      const sy = i * h + hash2(i * 20 + s, 131) * (h - 3);
      gCol.fillStyle = 'rgba(62,40,22,0.14)';
      gCol.fillRect(0, sy, S, 1.2);
    }
  }

  return {
    map: finalizeTex(cCol, aniso, true),
    bumpMap: finalizeTex(cBmp, aniso, false),
  };
}

// 8. Stunt Ramp Chevron Decking
export function createRampStripeTex(aniso: number): THREE.CanvasTexture {
  const [c, g] = makeCanvas(256, 256);
  g.fillStyle = '#1b202b';
  g.fillRect(0, 0, 256, 256);
  // Side caution stripes
  g.fillStyle = '#f5b841';
  g.fillRect(0, 0, 24, 256);
  g.fillRect(232, 0, 24, 256);
  g.fillStyle = '#151821';
  for (let y = -32; y < 288; y += 32) {
    g.beginPath();
    g.moveTo(0, y);
    g.lineTo(24, y + 16);
    g.lineTo(24, y + 30);
    g.lineTo(0, y + 14);
    g.closePath();
    g.fill();
    g.beginPath();
    g.moveTo(232, y);
    g.lineTo(256, y + 16);
    g.lineTo(256, y + 30);
    g.lineTo(232, y + 14);
    g.closePath();
    g.fill();
  }
  // Center cyan/amber launch chevrons
  g.strokeStyle = '#33e6d6';
  g.lineWidth = 10;
  for (let y = 44; y < 244; y += 64) {
    g.beginPath();
    g.moveTo(68, y + 26);
    g.lineTo(128, y - 10);
    g.lineTo(188, y + 26);
    g.stroke();
  }
  return finalizeTex(c, aniso, true, true);
}

// 9. Micro-flake / Carbon-weave Car Paint Bump Map
export function createCarbonBumpTex(aniso: number): THREE.CanvasTexture {
  const [c, g] = makeCanvas(128, 128);
  g.fillStyle = '#808080';
  g.fillRect(0, 0, 128, 128);
  for (let y = 0; y < 128; y += 4) {
    for (let x = 0; x < 128; x += 4) {
      const alt = ((x + y) >> 2) % 2 === 0;
      g.fillStyle = alt ? '#a2a2a2' : '#5e5e5e';
      g.fillRect(x, y, 4, 2);
      g.fillStyle = alt ? '#666666' : '#969696';
      g.fillRect(x, y + 2, 4, 2);
    }
  }
  return finalizeTex(c, aniso, false, true);
}

// Soft radial glow sprite
let _glowTex: THREE.CanvasTexture | null = null;
export function glowTexture(): THREE.CanvasTexture {
  if (_glowTex) return _glowTex;
  const [c, g] = makeCanvas(128, 128);
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, 'rgba(255,255,255,1)');
  gr.addColorStop(0.26, 'rgba(255,255,255,0.65)');
  gr.addColorStop(0.65, 'rgba(255,255,255,0.14)');
  gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, 128, 128);
  _glowTex = new THREE.CanvasTexture(c);
  _glowTex.colorSpace = THREE.SRGBColorSpace;
  return _glowTex;
}

// Soft cloud/smoke puff sprite
let _smokeTex: THREE.CanvasTexture | null = null;
export function smokeTexture(): THREE.CanvasTexture {
  if (_smokeTex) return _smokeTex;
  const [c, g] = makeCanvas(128, 128);
  for (let i = 0; i < 6; i++) {
    const x = 64 + Math.cos(i * 1.1) * 14;
    const y = 64 + Math.sin(i * 1.1) * 14;
    const gr = g.createRadialGradient(x, y, 4, x, y, 42);
    gr.addColorStop(0, 'rgba(255,255,255,0.45)');
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, 128, 128);
  }
  _smokeTex = new THREE.CanvasTexture(c);
  _smokeTex.colorSpace = THREE.SRGBColorSpace;
  return _smokeTex;
}

// Crisp Art-Deco neon signage texture with dark anodized marquee backing
export function neonTexture(text: string, color: string): THREE.CanvasTexture {
  const [c, g] = makeCanvas(512, 128);
  g.clearRect(0, 0, 512, 128);
  // Sleek dark architectural signboard backing so neon reads crisply even in golden hour sunlight
  g.fillStyle = 'rgba(12, 10, 26, 0.84)';
  g.fillRect(10, 10, 492, 108);
  g.strokeStyle = color;
  g.lineWidth = 4;
  g.shadowColor = color;
  g.shadowBlur = 14;
  g.strokeRect(14, 14, 484, 100);
  g.lineWidth = 1.5;
  g.strokeRect(22, 22, 468, 84);
  g.font = '800 52px "Barlow Condensed", Impact, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillStyle = color;
  g.fillText(text, 256, 66);
  g.shadowBlur = 3;
  g.fillStyle = '#ffffff';
  g.globalAlpha = 0.62;
  g.fillText(text, 256, 66);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Vintage Coastal Travel-Poster Billboard
export function billboardTexture(
  title: string,
  sub: string,
  c1: string,
  c2: string,
): THREE.CanvasTexture {
  const [c, g] = makeCanvas(512, 256);
  const bg = g.createLinearGradient(0, 0, 512, 256);
  bg.addColorStop(0, c1);
  bg.addColorStop(1, c2);
  g.fillStyle = bg;
  g.fillRect(0, 0, 512, 256);

  // Geometric sun disc & deco corner accents
  g.fillStyle = 'rgba(255,255,255,0.16)';
  g.beginPath();
  g.arc(430, 128, 110, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = 'rgba(255,255,255,0.5)';
  g.lineWidth = 4;
  g.strokeRect(14, 14, 484, 228);

  g.fillStyle = '#0c1018';
  g.globalAlpha = 0.28;
  g.fillRect(28, 42, 456, 172);
  g.globalAlpha = 1;

  g.fillStyle = '#ffffff';
  g.font = '800 66px "Barlow Condensed", Impact, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.shadowColor = 'rgba(0,0,0,0.45)';
  g.shadowBlur = 10;
  g.fillText(title, 256, 108);

  g.font = '600 26px "Plus Jakarta Sans", sans-serif';
  g.fillStyle = '#fff5dc';
  g.fillText(sub.toUpperCase(), 256, 176);

  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// 10. Weathered Coastal Coconut Palm Bark (organic gray-tan fibrous rings + bump)
export function createPalmBarkSet(aniso: number): PBRTextureSet {
  const S = 256;
  const [cCol, gCol] = makeCanvas(S, S);
  const [cBmp, gBmp] = makeCanvas(S, S);

  gCol.fillStyle = '#8b7b6b';
  gCol.fillRect(0, 0, S, S);
  gBmp.fillStyle = '#808080';
  gBmp.fillRect(0, 0, S, S);

  // Subtle weathered coastal palm growth-scar rings (natural silver-tan, not harsh stripes)
  const rings = 16;
  const step = S / rings;
  for (let i = 0; i < rings; i++) {
    const y = i * step;
    const tone = 128 + Math.floor((hash2(i, 211) - 0.5) * 18);
    const grad = gCol.createLinearGradient(0, y, 0, y + step);
    grad.addColorStop(0, `rgb(${tone + 10}, ${tone + 2}, ${tone - 8})`);
    grad.addColorStop(0.68, `rgb(${tone + 2}, ${tone - 5}, ${tone - 14})`);
    grad.addColorStop(0.84, `rgb(${tone - 26}, ${tone - 30}, ${tone - 34})`);
    grad.addColorStop(1, `rgb(${tone - 4}, ${tone - 10}, ${tone - 18})`);
    gCol.fillStyle = grad;
    gCol.fillRect(0, y, S, step + 1);

    // Subtle organic wave along ring scar
    gBmp.fillStyle = '#b8b8b8';
    gBmp.fillRect(0, y + step * 0.52, S, step * 0.24);
    gBmp.fillStyle = '#4a4a4a';
    gBmp.fillRect(0, y + step * 0.78, S, step * 0.16);
  }

  // Fine vertical fibrous bark grain & coastal lichen flecks
  for (let i = 0; i < 1400; i++) {
    const x = hash2(i, 223) * S;
    const y = hash2(i, 227) * S;
    const h = 6 + hash2(i, 229) * 16;
    gCol.fillStyle =
      hash2(i, 233) > 0.48
        ? 'rgba(198,188,174,0.16)'
        : 'rgba(64,52,44,0.18)';
    gCol.fillRect(x, y, 1.6, h);
    gBmp.fillStyle = hash2(i, 239) > 0.5 ? 'rgba(205,205,205,0.28)' : 'rgba(62,62,62,0.28)';
    gBmp.fillRect(x, y, 1.4, h);
  }

  return {
    map: finalizeTex(cCol, aniso, true),
    bumpMap: finalizeTex(cBmp, aniso, false),
  };
}

// 11. Alpha-Cutout Feathered Tropical Palm Frond (rich individual leaflets + central rachis)
let _palmFrondTex: THREE.CanvasTexture | null = null;
export function createPalmFrondTex(aniso: number): THREE.CanvasTexture {
  if (_palmFrondTex) return _palmFrondTex;
  const W = 256;
  const H = 512;
  const [c, g] = makeCanvas(W, H);
  g.clearRect(0, 0, W, H);

  const cx = W / 2;

  // Individual feathered leaflets radiating along both sides of the spine
  const pairs = 26;
  for (let i = 0; i < pairs; i++) {
    const t = i / (pairs - 1); // 0 = base near crown, 1 = sunlit tip
    const y = 18 + t * (H - 36);
    const envelope = Math.sin(Math.pow(t, 0.72) * Math.PI * 0.94 + 0.14);
    const bladeLen = (24 + envelope * 98) * (0.9 + hash2(i, 307) * 0.18);
    const bladeW = 7.5 + (1 - Math.abs(t - 0.45)) * 4.5;

    for (const side of [-1, 1]) {
      const droop = 16 + t * 28 + hash2(i * 3 + side, 311) * 10;
      const tipX = cx + side * bladeLen;
      const tipY = y + droop;
      const midX = cx + side * bladeLen * 0.54;
      const midY = y + droop * 0.25;

      const grad = g.createLinearGradient(cx, y, tipX, tipY);
      const rBase = Math.floor(42 + t * 26);
      const gBase = Math.floor(110 + t * 38 + hash2(i, 313) * 18);
      const bBase = Math.floor(34 + t * 14);
      grad.addColorStop(0, `rgb(${rBase - 8}, ${gBase - 14}, ${bBase})`);
      grad.addColorStop(0.55, `rgb(${rBase + 16}, ${gBase + 22}, ${bBase + 6})`);
      grad.addColorStop(1, `rgb(${rBase + 48}, ${gBase + 42}, ${bBase + 10})`);

      g.fillStyle = grad;
      g.beginPath();
      g.moveTo(cx, y - bladeW * 0.42);
      g.quadraticCurveTo(midX, midY - bladeW * 0.55, tipX, tipY);
      g.quadraticCurveTo(midX, midY + bladeW * 0.42, cx, y + bladeW * 0.45);
      g.closePath();
      g.fill();

      // Crisp specular center rib on each leaflet
      g.strokeStyle = 'rgba(188, 224, 112, 0.34)';
      g.lineWidth = 1.1;
      g.beginPath();
      g.moveTo(cx, y);
      g.quadraticCurveTo(midX, midY - 1, tipX * 0.96 + cx * 0.04, tipY * 0.96 + y * 0.04);
      g.stroke();
    }
  }

  // Central woody fibrous stem (rachis)
  const stemGrad = g.createLinearGradient(0, 0, 0, H);
  stemGrad.addColorStop(0, '#6a7c32');
  stemGrad.addColorStop(0.5, '#86a23e');
  stemGrad.addColorStop(1, '#a9c454');
  g.strokeStyle = stemGrad;
  g.lineWidth = 7;
  g.lineCap = 'round';
  g.beginPath();
  g.moveTo(cx, 6);
  g.lineTo(cx, H - 14);
  g.stroke();

  _palmFrondTex = finalizeTex(c, aniso, true, false);
  return _palmFrondTex;
}

// 12. Mediterranean Terracotta Barrel-Tile Roof (Palm Heights villas)
export function createTerracottaSet(aniso: number): PBRTextureSet {
  const S = 256;
  const [cCol, gCol] = makeCanvas(S, S);
  const [cBmp, gBmp] = makeCanvas(S, S);

  const cols = 8;
  const rows = 8;
  const cw = S / cols;
  const rh = S / rows;

  for (let r = 0; r < rows; r++) {
    for (let col = 0; col < cols; col++) {
      const x = col * cw;
      const y = r * rh;
      const tint = (hash2(col * 11 + r, 401) - 0.5) * 28;
      const gr = gCol.createLinearGradient(x, y, x + cw, y);
      gr.addColorStop(0, `rgb(${150 + tint}, ${66 + tint * 0.5}, ${42 + tint * 0.4})`);
      gr.addColorStop(0.45, `rgb(${214 + tint}, ${106 + tint * 0.5}, ${68 + tint * 0.4})`);
      gr.addColorStop(1, `rgb(${135 + tint}, ${58 + tint * 0.4}, ${36 + tint * 0.3})`);
      gCol.fillStyle = gr;
      gCol.fillRect(x, y, cw, rh);

      gCol.fillStyle = 'rgba(42, 18, 12, 0.42)';
      gCol.fillRect(x, y + rh - 3, cw, 3);

      const bg = gBmp.createLinearGradient(x, y, x + cw, y);
      bg.addColorStop(0, '#363636');
      bg.addColorStop(0.5, '#e8e8e8');
      bg.addColorStop(1, '#303030');
      gBmp.fillStyle = bg;
      gBmp.fillRect(x, y, cw, rh - 2);
      gBmp.fillStyle = '#181818';
      gBmp.fillRect(x, y + rh - 2, cw, 2);
    }
  }

  return {
    map: finalizeTex(cCol, aniso, true),
    bumpMap: finalizeTex(cBmp, aniso, false),
  };
}

// 13. Woven Linen Fabric Bump + Tropical Vice Coast Resort Shirt Print
let _fabricBump: THREE.CanvasTexture | null = null;
export function createFabricBumpTex(aniso = 4): THREE.CanvasTexture {
  if (_fabricBump) return _fabricBump;
  const S = 128;
  const [c, g] = makeCanvas(S, S);
  g.fillStyle = '#808080';
  g.fillRect(0, 0, S, S);
  for (let y = 0; y < S; y += 2) {
    for (let x = 0; x < S; x += 2) {
      const v = ((x + y) & 2) === 0 ? 152 : 104;
      g.fillStyle = `rgb(${v},${v},${v})`;
      g.fillRect(x, y, 2, 2);
    }
  }
  _fabricBump = finalizeTex(c, aniso, false, true);
  _fabricBump.repeat.set(6, 6);
  return _fabricBump;
}

let _resortShirtTex: THREE.CanvasTexture | null = null;
export function createResortShirtTex(aniso = 4): THREE.CanvasTexture {
  if (_resortShirtTex) return _resortShirtTex;
  const S = 256;
  const [c, g] = makeCanvas(S, S);
  // Crisp Miami aqua-turquoise linen base
  const grad = g.createLinearGradient(0, 0, 0, S);
  grad.addColorStop(0, '#1bd4cf');
  grad.addColorStop(0.55, '#15b8c2');
  grad.addColorStop(1, '#0e96a8');
  g.fillStyle = grad;
  g.fillRect(0, 0, S, S);

  // Subtle woven linen crosshatch
  g.strokeStyle = 'rgba(255,255,255,0.08)';
  g.lineWidth = 1;
  for (let i = 0; i < S; i += 4) {
    g.beginPath();
    g.moveTo(i, 0);
    g.lineTo(i, S);
    g.moveTo(0, i);
    g.lineTo(S, i);
    g.stroke();
  }

  // Stylized tropical palm fronds & coral hibiscus accents
  for (let i = 0; i < 16; i++) {
    const px = hash2(i, 501) * S;
    const py = hash2(i, 503) * S;
    const ang = hash2(i, 509) * Math.PI * 2;
    g.save();
    g.translate(px, py);
    g.rotate(ang);
    g.fillStyle = i % 3 === 0 ? 'rgba(255, 72, 152, 0.34)' : 'rgba(8, 62, 82, 0.28)';
    for (let f = -2; f <= 2; f++) {
      g.beginPath();
      g.ellipse(f * 5, 0, 18, 4.5, f * 0.28, 0, Math.PI * 2);
      g.fill();
    }
    g.restore();
  }

  _resortShirtTex = finalizeTex(c, aniso, true, true);
  return _resortShirtTex;
}

// 14. Automotive Tire Tread Bump Texture
let _tireTread: THREE.CanvasTexture | null = null;
export function createTireTreadTex(aniso = 4): THREE.CanvasTexture {
  if (_tireTread) return _tireTread;
  const S = 128;
  const [c, g] = makeCanvas(S, S);
  g.fillStyle = '#909090';
  g.fillRect(0, 0, S, S);
  g.fillStyle = '#282828';
  // Circumferential drainage grooves
  g.fillRect(36, 0, 6, S);
  g.fillRect(86, 0, 6, S);
  // Diagonal sipes
  g.strokeStyle = '#242424';
  g.lineWidth = 4;
  for (let y = -16; y < S + 16; y += 16) {
    g.beginPath();
    g.moveTo(0, y);
    g.lineTo(36, y + 12);
    g.moveTo(128, y);
    g.lineTo(92, y + 12);
    g.moveTo(42, y + 6);
    g.lineTo(86, y - 4);
    g.stroke();
  }
  _tireTread = finalizeTex(c, aniso, false, true);
  _tireTread.repeat.set(1, 5);
  return _tireTread;
}

// 15. Feathered Ambient Occlusion Contact Shadow Texture (for cars & characters)
let _carShadowTex: THREE.CanvasTexture | null = null;
export function createCarShadowTex(): THREE.CanvasTexture {
  if (_carShadowTex) return _carShadowTex;
  const [c, g] = makeCanvas(128, 256);
  g.clearRect(0, 0, 128, 256);
  g.save();
  g.translate(64, 128);
  g.scale(1, 2);
  const gr = g.createRadialGradient(0, 0, 12, 0, 0, 60);
  gr.addColorStop(0, 'rgba(4, 6, 14, 0.72)');
  gr.addColorStop(0.58, 'rgba(4, 6, 14, 0.42)');
  gr.addColorStop(0.84, 'rgba(4, 6, 14, 0.14)');
  gr.addColorStop(1, 'rgba(4, 6, 14, 0)');
  g.fillStyle = gr;
  g.beginPath();
  g.arc(0, 0, 60, 0, Math.PI * 2);
  g.fill();
  g.restore();
  _carShadowTex = new THREE.CanvasTexture(c);
  _carShadowTex.colorSpace = THREE.SRGBColorSpace;
  return _carShadowTex;
}

// 16. Vice Coast Retro Coastal License Plate Texture
let _plateTex: THREE.CanvasTexture | null = null;
export function createLicensePlateTex(): THREE.CanvasTexture {
  if (_plateTex) return _plateTex;
  const [c, g] = makeCanvas(256, 128);
  const bg = g.createLinearGradient(0, 0, 0, 128);
  bg.addColorStop(0, '#fdfbf7');
  bg.addColorStop(0.7, '#f2f7f7');
  bg.addColorStop(1, '#d8f6f2');
  g.fillStyle = bg;
  g.fillRect(0, 0, 256, 128);
  g.strokeStyle = '#ff2e93';
  g.lineWidth = 6;
  g.strokeRect(5, 5, 246, 118);
  g.fillStyle = '#00a896';
  g.font = '800 22px "Barlow Condensed", sans-serif';
  g.textAlign = 'center';
  g.fillText('VICE COAST', 128, 34);
  g.fillStyle = '#15192a';
  g.font = '800 54px "JetBrains Mono", monospace';
  g.fillText('VC-86', 128, 94);
  _plateTex = new THREE.CanvasTexture(c);
  _plateTex.colorSpace = THREE.SRGBColorSpace;
  return _plateTex;
}

// 17. Tailored Indigo Denim Fabric Texture (for realistic trousers & jeans)
let _denimTex: THREE.CanvasTexture | null = null;
export function createDenimTex(aniso = 4): THREE.CanvasTexture {
  if (_denimTex) return _denimTex;
  const S = 128;
  const [c, g] = makeCanvas(S, S);
  const grad = g.createLinearGradient(0, 0, S, 0);
  grad.addColorStop(0, '#1e273d');
  grad.addColorStop(0.5, '#2a3754');
  grad.addColorStop(1, '#1c2438');
  g.fillStyle = grad;
  g.fillRect(0, 0, S, S);
  // Diagonal twill denim weave
  g.strokeStyle = 'rgba(205, 220, 248, 0.08)';
  g.lineWidth = 1;
  for (let i = -S; i < S * 2; i += 3) {
    g.beginPath();
    g.moveTo(i, 0);
    g.lineTo(i - S * 0.5, S);
    g.stroke();
  }
  // Subtle outer seam topstitching
  g.strokeStyle = 'rgba(218, 174, 112, 0.25)';
  g.setLineDash([4, 3]);
  g.beginPath();
  g.moveTo(6, 0);
  g.lineTo(6, S);
  g.moveTo(S - 6, 0);
  g.lineTo(S - 6, S);
  g.stroke();
  _denimTex = finalizeTex(c, aniso, true, true);
  return _denimTex;
}

// 18. Lucia Reyes Signature Coral-Rose Ribbed Top & Sunset Stripe Texture
let _luciaTopTex: THREE.CanvasTexture | null = null;
export function createLuciaTopTex(aniso = 4): THREE.CanvasTexture {
  if (_luciaTopTex) return _luciaTopTex;
  const S = 256;
  const [c, g] = makeCanvas(S, S);
  const grad = g.createLinearGradient(0, 0, 0, S);
  grad.addColorStop(0, '#ff4d8d');
  grad.addColorStop(0.55, '#e83878');
  grad.addColorStop(1, '#c82968');
  g.fillStyle = grad;
  g.fillRect(0, 0, S, S);
  // Fine vertical ribbed knit texture
  for (let x = 0; x < S; x += 4) {
    g.fillStyle = x % 8 === 0 ? 'rgba(255,255,255,0.08)' : 'rgba(40,6,22,0.1)';
    g.fillRect(x, 0, 2, S);
  }
  // Subtle cream hem trim
  g.fillStyle = 'rgba(255, 240, 232, 0.24)';
  g.fillRect(0, S - 10, S, 6);
  _luciaTopTex = finalizeTex(c, aniso, true, true);
  return _luciaTopTex;
}


