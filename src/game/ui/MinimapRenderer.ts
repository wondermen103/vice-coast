// MinimapRenderer: High-detail realistic satellite & architectural cartography atlas for both
// the GTA VI bottom-left navigation GPS radar and the interactive full-city tactical map.
import {
  BEACH_W,
  BLOCK,
  GRID,
  PIER_Z,
  ROAD,
  SIZE,
  STUNT_RAMPS,
  lots,
  route,
} from '../world/CityLayout.ts';
import { PLACES } from '../missions/StoryMissions.ts';
import { Rng, clamp } from '../core/MathUtil.ts';
import type { MinimapBlip } from '../missions/MissionDirector.ts';

const ALL_LOTS = lots();

export interface MinimapState {
  px: number;
  pz: number;
  heading: number;
  camYaw: number;
  speedKmh?: number;
  inVehicle?: boolean;
  wantedLevel: number;
  blips: MinimapBlip[];
  gpsTarget: { x: number; z: number; color: string } | null;
  cops: Array<{ x: number; z: number; heading: number; isHeli?: boolean }>;
  traffic?: Array<{ x: number; z: number; heading: number }>;
}

// World bounds for the pre-baked realistic aerial/satellite atlas
const ATLAS_X0 = -240;
const ATLAS_Z0 = -140;
const ATLAS_WORLD_W = SIZE + 380; // -240 .. SIZE + 140
const ATLAS_WORLD_H = SIZE + 280; // -140 .. SIZE + 140
const ATLAS_PPM = 1.65; // pixels per meter (~1450x1280 sharp satellite atlas)

let cachedAtlas: HTMLCanvasElement | null = null;

function drawPalmCrown(
  ctx: CanvasRenderingContext2D,
  x: number,
  z: number,
  r: number,
  seed: number,
): void {
  // Soft directional sun shadow on ground
  ctx.fillStyle = 'rgba(12, 18, 24, 0.34)';
  ctx.beginPath();
  ctx.arc(x + r * 0.55, z + r * 0.65, r * 0.92, 0, Math.PI * 2);
  ctx.fill();

  // Layered tropical fronds
  const fronds = 7;
  ctx.strokeStyle = '#255a30';
  ctx.lineWidth = Math.max(0.85, r * 0.36);
  ctx.lineCap = 'round';
  for (let i = 0; i < fronds; i++) {
    const a = seed + (i / fronds) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(x, z);
    ctx.lineTo(x + Math.cos(a) * r, z + Math.sin(a) * r);
    ctx.stroke();
  }
  ctx.strokeStyle = '#4f9149';
  ctx.lineWidth = Math.max(0.55, r * 0.2);
  for (let i = 0; i < fronds; i++) {
    const a = seed + (i / fronds) * Math.PI * 2 + 0.16;
    ctx.beginPath();
    ctx.moveTo(x, z);
    ctx.lineTo(x + Math.cos(a) * r * 0.84, z + Math.sin(a) * r * 0.84);
    ctx.stroke();
  }
  ctx.fillStyle = '#6db35b';
  ctx.beginPath();
  ctx.arc(x, z, r * 0.22, 0, Math.PI * 2);
  ctx.fill();
}

function drawRealisticPool(
  ctx: CanvasRenderingContext2D,
  x: number,
  z: number,
  w: number,
  h: number,
): void {
  // White stone pool deck
  ctx.fillStyle = '#d4d0c5';
  ctx.fillRect(x - 1.2, z - 1.2, w + 2.4, h + 2.4);
  // Bright turquoise pool water
  const g = ctx.createLinearGradient(x, z, x + w, z + h);
  g.addColorStop(0, '#36c9db');
  g.addColorStop(0.5, '#1fa6c4');
  g.addColorStop(1, '#26bfd6');
  ctx.fillStyle = g;
  ctx.fillRect(x, z, w, h);
  ctx.strokeStyle = 'rgba(255,255,255,0.45)';
  ctx.lineWidth = 0.55;
  ctx.strokeRect(x + 0.5, z + 0.5, w - 1, h - 1);
}

function buildRealisticWorldAtlas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(ATLAS_WORLD_W * ATLAS_PPM);
  canvas.height = Math.ceil(ATLAS_WORLD_H * ATLAS_PPM);
  const ctx = canvas.getContext('2d')!;
  const rng = new Rng(7331);

  ctx.save();
  ctx.scale(ATLAS_PPM, ATLAS_PPM);
  ctx.translate(-ATLAS_X0, -ATLAS_Z0);

  // 1. REALISTIC ATLANTIC OCEAN & COASTAL PENINSULA BATHYMETRY (surrounds entire Vice Coast island)
  ctx.fillStyle = '#082138';
  ctx.fillRect(ATLAS_X0, ATLAS_Z0, ATLAS_WORLD_W, ATLAS_WORLD_H);

  // Layered realistic coastal shelf & tropical turquoise shallows radiating from the island landmass
  const islandX0 = -ROAD / 2 - BEACH_W;
  const islandZ0 = -ROAD / 2 - 18;
  const islandW = SIZE + ROAD + BEACH_W + 6;
  const islandH = SIZE + ROAD + 36;

  const shelfBands: Array<[number, string]> = [
    [135, '#0c314e'],
    [82, '#114a6a'],
    [42, '#196e87'],
    [18, '#2694a4'],
    [6, '#48b7bb'],
  ];
  for (const [pad, col] of shelfBands) {
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.roundRect(
      islandX0 - pad,
      islandZ0 - pad,
      islandW + pad * 2,
      islandH + pad * 2,
      Math.min(72, 24 + pad * 0.55),
    );
    ctx.fill();
  }

  // Subtle bathymetry depth contour lines offshore
  ctx.strokeStyle = 'rgba(170, 236, 255, 0.09)';
  ctx.lineWidth = 1.2;
  for (const pad of [112, 62, 28]) {
    ctx.beginPath();
    ctx.roundRect(
      islandX0 - pad,
      islandZ0 - pad,
      islandW + pad * 2,
      islandH + pad * 2,
      Math.min(68, 22 + pad * 0.5),
    );
    ctx.stroke();
  }

  // Soft ocean wave ripples around the coast
  ctx.strokeStyle = 'rgba(210, 245, 255, 0.1)';
  ctx.lineWidth = 0.9;
  for (let i = 0; i < 110; i++) {
    const wx = rng.range(-225, -72);
    const wz = rng.range(ATLAS_Z0 + 10, SIZE + 110);
    const len = rng.range(8, 22);
    ctx.beginPath();
    ctx.moveTo(wx, wz);
    ctx.quadraticCurveTo(wx + 2.5, wz + len * 0.5, wx, wz + len);
    ctx.stroke();
  }

  // 2. REALISTIC SUNSET BEACH SAND, SURF FOAM & COASTAL PENINSULA SHORE
  const beachLeft = -ROAD / 2 - BEACH_W;
  const beachGrad = ctx.createLinearGradient(beachLeft - 4, 0, -ROAD / 2, 0);
  beachGrad.addColorStop(0, '#8d7f63'); // wet surf sand
  beachGrad.addColorStop(0.16, '#b7a480');
  beachGrad.addColorStop(0.48, '#cbb892');
  beachGrad.addColorStop(1, '#d4c3a0');
  ctx.fillStyle = beachGrad;
  ctx.beginPath();
  ctx.moveTo(-ROAD / 2 + 8, islandZ0);
  ctx.lineTo(-ROAD / 2 + 8, islandZ0 + islandH);
  for (let z = islandZ0 + islandH; z >= islandZ0; z -= 12) {
    const edgeTaper =
      z < islandZ0 + 26
        ? (islandZ0 + 26 - z) * 0.45
        : z > islandZ0 + islandH - 26
          ? (z - (islandZ0 + islandH - 26)) * 0.45
          : 0;
    const shoreX = beachLeft + edgeTaper + Math.sin(z * 0.032) * 3.4 + Math.cos(z * 0.085) * 1.4;
    ctx.lineTo(shoreX, z);
  }
  ctx.closePath();
  ctx.fill();

  // Breaking white coastal surf foam ribbon along western beach
  ctx.strokeStyle = 'rgba(242, 252, 255, 0.58)';
  ctx.lineWidth = 2.6;
  ctx.beginPath();
  for (let z = islandZ0 + 4; z <= islandZ0 + islandH - 4; z += 10) {
    const edgeTaper =
      z < islandZ0 + 26
        ? (islandZ0 + 26 - z) * 0.45
        : z > islandZ0 + islandH - 26
          ? (z - (islandZ0 + islandH - 26)) * 0.45
          : 0;
    const shoreX = beachLeft - 1.2 + edgeTaper + Math.sin(z * 0.032) * 3.4 + Math.cos(z * 0.085) * 1.4;
    if (z === islandZ0 + 4) ctx.moveTo(shoreX, z);
    else ctx.lineTo(shoreX, z);
  }
  ctx.stroke();

  ctx.strokeStyle = 'rgba(220, 248, 255, 0.28)';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  for (let z = islandZ0 + 8; z <= islandZ0 + islandH - 8; z += 10) {
    const shoreX = beachLeft - 6.5 + Math.sin(z * 0.032 + 0.5) * 3.8;
    if (z === islandZ0 + 8) ctx.moveTo(shoreX, z);
    else ctx.lineTo(shoreX, z);
  }
  ctx.stroke();

  // Coastal seawall & harbor bulkhead along north, south & east peninsula perimeter
  ctx.fillStyle = '#475c48';
  ctx.beginPath();
  ctx.roundRect(-ROAD / 2, islandZ0 + 1, SIZE + ROAD + 4, islandH - 2, 10);
  ctx.fill();
  ctx.strokeStyle = '#9aa1ab';
  ctx.lineWidth = 2.2;
  ctx.stroke();

  // Subtle beach dune vegetation & boardwalk promenade strip
  ctx.fillStyle = '#a9a296';
  ctx.fillRect(-ROAD / 2 - 4.8, -28, 4.8, SIZE + 56);
  ctx.strokeStyle = 'rgba(255,255,255,0.22)';
  ctx.lineWidth = 0.6;
  ctx.beginPath();
  ctx.moveTo(-ROAD / 2 - 4.8, -28);
  ctx.lineTo(-ROAD / 2 - 4.8, SIZE + 28);
  ctx.stroke();

  // Beach umbrellas & lifeguard towers (aerial view)
  const umbColors = ['#ec4899', '#14b8a6', '#f59e0b', '#fb7185', '#6366f1', '#f8fafc'];
  for (let i = 0; i < 68; i++) {
    const ux = rng.range(-54, -22);
    const uz = rng.range(-20, SIZE + 20);
    if (Math.abs(uz - PIER_Z) < 13) continue;
    ctx.fillStyle = 'rgba(18, 20, 28, 0.28)';
    ctx.beginPath();
    ctx.arc(ux + 1.0, uz + 1.1, 1.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = rng.pick(umbColors);
    ctx.beginPath();
    ctx.arc(ux, uz, 1.7, 0, Math.PI * 2);
    ctx.fill();
  }
  for (const lz of [48, 140, 325, 455, 548]) {
    ctx.fillStyle = 'rgba(10, 14, 22, 0.35)';
    ctx.fillRect(-49.2, lz - 1.5, 4.6, 4.6);
    ctx.fillStyle = '#f8f5ef';
    ctx.fillRect(-50, lz - 2.3, 4.4, 4.4);
    ctx.fillStyle = '#ff2e93';
    ctx.fillRect(-49.2, lz - 1.5, 2.8, 2.8);
  }

  // Detailed Vice Lighthouse Pier (shadow + timber planks + lighthouse dome)
  const pierX0 = -ROAD / 2 - 154;
  const pierLen = 148;
  ctx.fillStyle = 'rgba(6, 18, 30, 0.42)';
  ctx.fillRect(pierX0 + 2, PIER_Z - 3.0, pierLen, 10.5);
  ctx.fillStyle = '#8b7155';
  ctx.fillRect(pierX0, PIER_Z - 4.6, pierLen, 9.2);
  ctx.strokeStyle = 'rgba(42, 30, 18, 0.38)';
  ctx.lineWidth = 0.6;
  for (let px = pierX0 + 3; px < pierX0 + pierLen; px += 3.5) {
    ctx.beginPath();
    ctx.moveTo(px, PIER_Z - 4.4);
    ctx.lineTo(px, PIER_Z + 4.4);
    ctx.stroke();
  }
  // Lighthouse circular deck & white roof dome at west end
  ctx.fillStyle = '#6f5942';
  ctx.beginPath();
  ctx.arc(pierX0 + 4, PIER_Z, 8.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#f3eee4';
  ctx.beginPath();
  ctx.arc(pierX0 + 4, PIER_Z, 4.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ff3d63';
  ctx.beginPath();
  ctx.arc(pierX0 + 4, PIER_Z, 1.8, 0, Math.PI * 2);
  ctx.fill();

  // 3. REALISTIC CITY LANDMASS, PAVED ASPHALT & SIDEWALK GRID
  // Full asphalt road deck
  ctx.fillStyle = '#262b34';
  ctx.fillRect(-ROAD / 2, -ROAD / 2, SIZE + ROAD, SIZE + ROAD);

  // Subtle lighter asphalt lane sheen + double-yellow centerlines + dashed dividers
  for (let k = 0; k <= GRID; k++) {
    const p = k * BLOCK;

    // Vertical avenues
    ctx.fillStyle = '#2d323d';
    ctx.fillRect(p - ROAD * 0.44, -ROAD / 2, ROAD * 0.88, SIZE + ROAD);
    // Double yellow center stripe
    ctx.strokeStyle = 'rgba(222, 178, 64, 0.72)';
    ctx.lineWidth = 0.55;
    ctx.beginPath();
    ctx.moveTo(p - 0.55, 0);
    ctx.lineTo(p - 0.55, SIZE);
    ctx.moveTo(p + 0.55, 0);
    ctx.lineTo(p + 0.55, SIZE);
    ctx.stroke();

    // Dashed lane dividers
    ctx.save();
    ctx.setLineDash([4, 5]);
    ctx.strokeStyle = 'rgba(235, 240, 248, 0.25)';
    ctx.lineWidth = 0.45;
    for (const lo of [-3.9, 3.9]) {
      ctx.beginPath();
      ctx.moveTo(p + lo, 0);
      ctx.lineTo(p + lo, SIZE);
      ctx.stroke();
    }
    ctx.restore();

    // Horizontal cross-streets
    ctx.fillStyle = '#2d323d';
    ctx.fillRect(-ROAD / 2, p - ROAD * 0.44, SIZE + ROAD, ROAD * 0.88);
    ctx.strokeStyle = 'rgba(222, 178, 64, 0.65)';
    ctx.lineWidth = 0.55;
    ctx.beginPath();
    ctx.moveTo(0, p - 0.55);
    ctx.lineTo(SIZE, p - 0.55);
    ctx.moveTo(0, p + 0.55);
    ctx.lineTo(SIZE, p + 0.55);
    ctx.stroke();

    ctx.save();
    ctx.setLineDash([4, 5]);
    ctx.strokeStyle = 'rgba(235, 240, 248, 0.25)';
    ctx.lineWidth = 0.45;
    for (const lo of [-3.9, 3.9]) {
      ctx.beginPath();
      ctx.moveTo(0, p + lo);
      ctx.lineTo(SIZE, p + lo);
      ctx.stroke();
    }
    ctx.restore();
  }

  // Intersection asphalt boxes + realistic white zebra crosswalks
  for (let kx = 0; kx <= GRID; kx++) {
    for (let kz = 0; kz <= GRID; kz++) {
      const ix = kx * BLOCK;
      const iz = kz * BLOCK;
      ctx.fillStyle = '#2a2f39';
      ctx.fillRect(ix - ROAD * 0.48, iz - ROAD * 0.48, ROAD * 0.96, ROAD * 0.96);

      ctx.fillStyle = 'rgba(240, 244, 250, 0.58)';
      const half = ROAD * 0.5 + 1.2;
      for (let s = -4.5; s <= 4.5; s += 2.25) {
        if (kz > 0) ctx.fillRect(ix + s - 0.55, iz - half - 2.6, 1.1, 2.6);
        if (kz < GRID) ctx.fillRect(ix + s - 0.55, iz + half, 1.1, 2.6);
        if (kx > 0) ctx.fillRect(ix - half - 2.6, iz + s - 0.55, 2.6, 1.1);
        if (kx < GRID) ctx.fillRect(ix + half, iz + s - 0.55, 2.6, 1.1);
      }
    }
  }

  // 4. REALISTIC ARCHITECTURAL LOTS, COURTYARDS, POOLS, ROOFTOPS & GREENERY
  const pastelRoofs = ['#d8cdc0', '#c8b8ab', '#dfd4c6', '#c2b4c2', '#b9c8c5'];
  const villaRoofs = ['#b56c50', '#c77d5c', '#a96248', '#d6c6b2'];
  const towerRoofs = ['#596678', '#485566', '#677487', '#3f4c5e', '#748296'];
  const containerCols = ['#b5483a', '#2c698d', '#2f857b', '#c9933b', '#4d5b6e'];

  for (const l of ALL_LOTS) {
    const bw = l.x1 - l.x0;
    const bh = l.z1 - l.z0;

    // Concrete sidewalk apron framing each block
    ctx.fillStyle = '#787e87';
    ctx.fillRect(l.x0, l.z0, bw, bh);
    ctx.strokeStyle = 'rgba(220, 226, 236, 0.32)';
    ctx.lineWidth = 0.7;
    ctx.strokeRect(l.x0 + 0.35, l.z0 + 0.35, bw - 0.7, bh - 0.7);

    // Inner parcel ground (courtyard, lawn, or industrial yard)
    const pad = 3.2;
    const ix = l.x0 + pad;
    const iz = l.z0 + pad;
    const iw = bw - pad * 2;
    const ih = bh - pad * 2;

    if (l.district === 'heights') {
      // Lush manicured Palm Heights estate lawns & parks
      ctx.fillStyle = '#3f7245';
      ctx.fillRect(ix, iz, iw, ih);
      // Subtle park grass stripes
      ctx.fillStyle = 'rgba(98, 152, 86, 0.25)';
      for (let gx = ix; gx < ix + iw; gx += 6) {
        ctx.fillRect(gx, iz, 3, ih);
      }
      // Cream driveway across parcel
      ctx.fillStyle = '#b9b4a8';
      ctx.fillRect(ix + iw * 0.44, iz, iw * 0.12, ih);
      ctx.fillRect(ix, iz + ih * 0.46, iw, ih * 0.09);

      // Two estate villas with hipped roofs & backyard pool
      for (const [vx, vz, vw, vh] of [
        [ix + 3, iz + 3, iw * 0.38, ih * 0.38],
        [ix + iw * 0.58, iz + ih * 0.56, iw * 0.36, ih * 0.36],
      ]) {
        ctx.fillStyle = 'rgba(14, 22, 18, 0.4)';
        ctx.fillRect(vx + 2.2, vz + 2.6, vw, vh);
        ctx.fillStyle = rng.pick(villaRoofs);
        ctx.fillRect(vx, vz, vw, vh);
        // Roof ridge line
        ctx.strokeStyle = 'rgba(255, 245, 232, 0.35)';
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.moveTo(vx + 2, vz + vh * 0.5);
        ctx.lineTo(vx + vw - 2, vz + vh * 0.5);
        ctx.stroke();
      }
      drawRealisticPool(ctx, ix + iw * 0.62, iz + 5, 11, 7);
      // Lush backyard trees
      for (let t = 0; t < 6; t++) {
        drawPalmCrown(
          ctx,
          rng.range(ix + 3, ix + iw - 3),
          rng.range(iz + 3, iz + ih - 3),
          rng.range(2.6, 3.8),
          rng.range(0, 6.28),
        );
      }
    } else if (l.district === 'port') {
      // Industrial Harbor Docks concrete yard + warehouses + colorful containers
      ctx.fillStyle = '#50555e';
      ctx.fillRect(ix, iz, iw, ih);
      // Ribbed warehouse roof
      const whW = iw * 0.52;
      const whH = ih * 0.58;
      ctx.fillStyle = 'rgba(10, 14, 20, 0.48)';
      ctx.fillRect(ix + 4.5, iz + 5.2, whW, whH);
      ctx.fillStyle = '#6f7782';
      ctx.fillRect(ix + 2, iz + 2.5, whW, whH);
      ctx.strokeStyle = 'rgba(30, 36, 46, 0.35)';
      ctx.lineWidth = 0.65;
      for (let rx = ix + 4; rx < ix + 2 + whW; rx += 3.2) {
        ctx.beginPath();
        ctx.moveTo(rx, iz + 2.5);
        ctx.lineTo(rx, iz + 2.5 + whH);
        ctx.stroke();
      }
      // Stacked intermodal shipping containers
      for (let row = 0; row < 4; row++) {
        for (let col = 0; col < 2; col++) {
          const cx = ix + iw * 0.6 + col * 8.5;
          const cz = iz + 3 + row * 9.5;
          if (cx + 7 < ix + iw && cz + 7.5 < iz + ih) {
            ctx.fillStyle = 'rgba(8, 12, 18, 0.42)';
            ctx.fillRect(cx + 1.2, cz + 1.4, 7.0, 7.6);
            ctx.fillStyle = rng.pick(containerCols);
            ctx.fillRect(cx, cz, 7.0, 7.6);
            ctx.strokeStyle = 'rgba(255,255,255,0.22)';
            ctx.lineWidth = 0.45;
            ctx.strokeRect(cx + 0.4, cz + 0.4, 6.2, 6.8);
          }
        }
      }
    } else if (l.district === 'downtown') {
      // Modern high-rise city block with deep cast shadows, glass towers & mechanical penthouses
      ctx.fillStyle = '#5c636e';
      ctx.fillRect(ix, iz, iw, ih);

      const cols = 2;
      const rows = 2;
      const cellW = iw / cols;
      const cellH = ih / rows;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const m = 2.2;
          const bx = ix + c * cellW + m;
          const bz = iz + r * cellH + m;
          const w = cellW - m * 2;
          const h = cellH - m * 2;
          // Deep skyscraper sun shadow
          ctx.fillStyle = 'rgba(10, 14, 24, 0.55)';
          ctx.fillRect(bx + 3.8, bz + 4.4, w, h);
          // Main tower roof
          ctx.fillStyle = rng.pick(towerRoofs);
          ctx.fillRect(bx, bz, w, h);
          ctx.strokeStyle = 'rgba(215, 228, 245, 0.28)';
          ctx.lineWidth = 0.7;
          ctx.strokeRect(bx + 0.5, bz + 0.5, w - 1, h - 1);
          // Inner setback penthouse & glass skylight
          ctx.fillStyle = '#313c4d';
          ctx.fillRect(bx + 3.5, bz + 3.5, w - 7, h - 7);
          ctx.fillStyle = 'rgba(125, 185, 215, 0.35)';
          ctx.fillRect(bx + 5.5, bz + 5.5, (w - 11) * 0.55, h - 11);
        }
      }
    } else if (l.district === 'malecon') {
      // Ocean Drive Art-Deco coastal resorts with rooftop pools & palm courtyards
      ctx.fillStyle = '#5d6b5e';
      ctx.fillRect(ix, iz, iw, ih);

      // Front Ocean Drive hotel + rear boutique tower
      const h1w = iw * 0.46;
      const h1h = ih - 3;
      ctx.fillStyle = 'rgba(14, 18, 28, 0.45)';
      ctx.fillRect(ix + 3.4, iz + 4.2, h1w, h1h);
      ctx.fillStyle = rng.pick(pastelRoofs);
      ctx.fillRect(ix + 1, iz + 1.5, h1w, h1h);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.lineWidth = 0.7;
      ctx.strokeRect(ix + 1.5, iz + 2, h1w - 1, h1h - 1);
      // Rooftop AC boxes
      ctx.fillStyle = '#8b909a';
      ctx.fillRect(ix + 4.5, iz + 6, 4.5, 6);
      ctx.fillRect(ix + 4.5, iz + h1h - 11, 5.5, 4.5);

      // Rear resort courtyard with turquoise swimming pool & palms
      const rx = ix + h1w + 4.5;
      const rw = iw - h1w - 5.5;
      if (rw > 12) {
        drawRealisticPool(ctx, rx + 2, iz + 5, rw - 4, ih * 0.36);
        ctx.fillStyle = 'rgba(14, 18, 28, 0.42)';
        ctx.fillRect(rx + 2.4, iz + ih * 0.52 + 2.6, rw - 2, ih * 0.42);
        ctx.fillStyle = rng.pick(pastelRoofs);
        ctx.fillRect(rx, iz + ih * 0.52, rw - 2, ih * 0.42);
      }
    } else {
      // Neon Strip entertainment district: plazas, club roofs & striped parking lots
      ctx.fillStyle = '#3c404b';
      ctx.fillRect(ix, iz, iw, ih);
      // Striped parking lot stalls on half of block
      ctx.strokeStyle = 'rgba(235, 238, 245, 0.32)';
      ctx.lineWidth = 0.5;
      for (let py = iz + 4; py < iz + ih - 4; py += 4.2) {
        ctx.beginPath();
        ctx.moveTo(ix + 2, py);
        ctx.lineTo(ix + 9, py);
        ctx.stroke();
      }
      // Two club / venue rooftops with neon skylight trims
      const b1x = ix + 13;
      const b1w = iw - 15;
      ctx.fillStyle = 'rgba(10, 12, 22, 0.5)';
      ctx.fillRect(b1x + 3, iz + 4.5, b1w, ih * 0.44);
      ctx.fillStyle = '#5c5468';
      ctx.fillRect(b1x, iz + 2, b1w, ih * 0.44);
      ctx.fillStyle = 'rgba(255, 46, 147, 0.45)';
      ctx.fillRect(b1x + 2, iz + 2, b1w - 4, 1.4);

      ctx.fillStyle = 'rgba(10, 12, 22, 0.5)';
      ctx.fillRect(b1x + 3, iz + ih * 0.55 + 2.5, b1w, ih * 0.4);
      ctx.fillStyle = '#4e586b';
      ctx.fillRect(b1x, iz + ih * 0.55, b1w, ih * 0.4);
      ctx.fillStyle = 'rgba(0, 240, 216, 0.42)';
      ctx.fillRect(b1x + 2, iz + ih * 0.55, b1w - 4, 1.4);
    }
  }

  // Helipad 'H' on Mercy Coastal Clinic & Downtown Precinct rooftops
  for (const key of ['hospital', 'precinct'] as const) {
    const p = PLACES[key];
    if (!p) continue;
    ctx.fillStyle = '#262d38';
    ctx.beginPath();
    ctx.arc(p.x + 8, p.z + 8, 6.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#f8fafc';
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    ctx.arc(p.x + 8, p.z + 8, 4.9, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#f8fafc';
    ctx.font = '700 6px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('H', p.x + 8, p.z + 8.3);
  }

  // 5. OCEAN DRIVE PROMENADE & BOULEVARD PALM CANOPIES ON MAP
  for (let z = -20; z <= SIZE + 20; z += 16) {
    if (Math.abs(z - PIER_Z) < 11) continue;
    drawPalmCrown(ctx, -ROAD / 2 - 2.6, z, 2.7, z * 0.13);
  }
  for (let kx = 0; kx <= 3; kx++) {
    for (let bz = 0; bz < GRID; bz++) {
      for (const off of [22, 50]) {
        const px = kx * BLOCK + (ROAD / 2 + 2.0);
        const pz = bz * BLOCK + off;
        if (Math.hypot(px - 10, pz - (3 * BLOCK + 24)) < 12.5) continue;
        drawPalmCrown(ctx, px, pz, 2.35, px + pz);
      }
    }
  }

  ctx.restore();
  return canvas;
}

function getWorldAtlas(): HTMLCanvasElement {
  if (!cachedAtlas) {
    cachedAtlas = buildRealisticWorldAtlas();
  }
  return cachedAtlas;
}

// Crisp miniature GTA-style vector map icons
function drawMapBlipIcon(
  ctx: CanvasRenderingContext2D,
  bx: number,
  by: number,
  blip: MinimapBlip,
  sizeScale = 1,
): void {
  ctx.save();
  ctx.translate(bx, by);
  ctx.scale(sizeScale, sizeScale);

  const r = blip.kind === 'goal' || blip.kind === 'story' || blip.kind === 'waypoint' ? 6.4 : 5.2;

  // Dark crisp outer casing
  ctx.fillStyle = '#090c14';
  ctx.beginPath();
  ctx.arc(0, 0, r + 1.4, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = blip.color;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();

  // Inner symbol glyph
  ctx.fillStyle = '#090c14';
  ctx.strokeStyle = '#090c14';
  ctx.lineWidth = 1.4;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  if (blip.kind === 'story') {
    // 5-point star
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = (i * Math.PI) / 5 - Math.PI / 2;
      const rr = i % 2 === 0 ? 3.8 : 1.7;
      if (i === 0) ctx.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
      else ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
    }
    ctx.closePath();
    ctx.fill();
  } else if (blip.kind === 'safe') {
    // House silhouette
    ctx.beginPath();
    ctx.moveTo(0, -3.2);
    ctx.lineTo(-3.2, 0.2);
    ctx.lineTo(-2.1, 0.2);
    ctx.lineTo(-2.1, 2.8);
    ctx.lineTo(2.1, 2.8);
    ctx.lineTo(2.1, 0.2);
    ctx.lineTo(3.2, 0.2);
    ctx.closePath();
    ctx.fill();
  } else if (blip.kind === 'garage') {
    // Wrench / repair bar
    ctx.beginPath();
    ctx.moveTo(-2.5, 2.5);
    ctx.lineTo(2.2, -2.2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(2.2, -2.2, 1.3, 0, Math.PI * 2);
    ctx.fill();
  } else if (blip.kind === 'shop') {
    // Crosshair target
    ctx.beginPath();
    ctx.arc(0, 0, 2.4, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, -3.6);
    ctx.lineTo(0, 3.6);
    ctx.moveTo(-3.6, 0);
    ctx.lineTo(3.6, 0);
    ctx.stroke();
  } else if (blip.kind === 'race') {
    // Checkered flag mark
    ctx.fillRect(-2.4, -2.6, 2.4, 2.2);
    ctx.fillRect(0, -0.4, 2.4, 2.2);
    ctx.beginPath();
    ctx.moveTo(-2.4, -2.8);
    ctx.lineTo(-2.4, 3.2);
    ctx.stroke();
  } else if (blip.kind === 'waypoint' || blip.kind === 'goal') {
    // Inner crisp target ring
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(0, 0, 2.3, 0, Math.PI * 2);
    ctx.fill();
  } else if (blip.kind === 'cashvan') {
    ctx.fillStyle = '#ffffff';
    ctx.font = '800 7px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('$', 0, 0.5);
  }
  ctx.restore();
}

export function drawCircularRadar(
  canvas: HTMLCanvasElement,
  state: MinimapState,
): void {
  drawGtaRadar(canvas, state);
}

export function drawGtaRadar(
  canvas: HTMLCanvasElement,
  state: MinimapState,
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const w = canvas.width;
  const h = canvas.height;
  // Forward-looking GTA VI GPS center (slightly below vertical midpoint)
  const cx = w * 0.5;
  const cy = h * 0.62;
  // Dynamic speed-adaptive zoom: crisp street/building view on foot, wider horizon view at high speed
  const spd = state.speedKmh ?? 0;
  const baseScale = state.inVehicle ? 0.72 : 0.84;
  const scale = clamp(baseScale - spd * 0.0014, 0.48, 0.86);
  const nowSec = performance.now() * 0.001;
  const atlas = getWorldAtlas();

  ctx.clearRect(0, 0, w, h);
  ctx.save();

  // Deep Atlantic ocean fill outside atlas edges
  ctx.fillStyle = '#09243d';
  ctx.fillRect(0, 0, w, h);

  ctx.translate(cx, cy);
  ctx.rotate(state.camYaw);
  ctx.scale(scale, scale);
  ctx.translate(-state.px, -state.pz);

  // Blit high-resolution pre-baked satellite & architectural city atlas
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(
    atlas,
    ATLAS_X0,
    ATLAS_Z0,
    ATLAS_WORLD_W,
    ATLAS_WORLD_H,
  );

  // Stunt ramp markers on road
  for (const r of STUNT_RAMPS) {
    ctx.save();
    ctx.translate(r.x, r.z);
    ctx.rotate(-r.heading);
    ctx.fillStyle = '#08101c';
    ctx.beginPath();
    ctx.moveTo(0, -6.4);
    ctx.lineTo(-5.0, 5.0);
    ctx.lineTo(5.0, 5.0);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#00f0d8';
    ctx.beginPath();
    ctx.moveTo(0, -4.8);
    ctx.lineTo(-3.6, 3.8);
    ctx.lineTo(3.6, 3.8);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  // Live nearby civilian traffic micro-blips on streets for real living-city GPS feel
  if (state.traffic && state.traffic.length > 0) {
    for (const car of state.traffic) {
      if (Math.hypot(car.x - state.px, car.z - state.pz) > 220) continue;
      ctx.save();
      ctx.translate(car.x, car.z);
      ctx.rotate(-car.heading);
      ctx.fillStyle = 'rgba(232, 240, 250, 0.72)';
      ctx.strokeStyle = 'rgba(10, 14, 22, 0.75)';
      ctx.lineWidth = 0.8;
      ctx.fillRect(-1.4, -2.5, 2.8, 5.0);
      ctx.strokeRect(-1.4, -2.5, 2.8, 5.0);
      ctx.restore();
    }
  }

  // Vivid GTA VI Turn-by-Turn GPS Route Line with dark casing & glowing magenta core
  let gpsDistMeters: number | null = null;
  if (state.gpsTarget) {
    const pts = route(state.px, state.pz, state.gpsTarget.x, state.gpsTarget.z);
    if (pts.length > 1) {
      let totalDist = 0;
      for (let i = 1; i < pts.length; i++) {
        totalDist += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
      }
      gpsDistMeters = Math.round(totalDist);

      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = 'rgba(8, 10, 18, 0.88)';
      ctx.lineWidth = 7.2;
      ctx.beginPath();
      ctx.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
      ctx.stroke();

      ctx.strokeStyle = state.gpsTarget.color || '#ff2e93';
      ctx.lineWidth = 4.4;
      ctx.beginPath();
      ctx.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
      ctx.stroke();

      // Subtle bright inner GPS navigation center filament
      ctx.strokeStyle = 'rgba(255, 235, 248, 0.65)';
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      ctx.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
      ctx.stroke();
    }
  }

  // VCPD police patrol cars + sweeping red/blue search vision cones
  const sirenFlash = Math.sin(nowSec * 10) > 0;
  for (const c of state.cops) {
    if (!c.isHeli) {
      ctx.save();
      ctx.translate(c.x, c.z);
      ctx.rotate(-c.heading);
      ctx.fillStyle = sirenFlash ? 'rgba(56, 152, 255, 0.28)' : 'rgba(255, 58, 102, 0.28)';
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, 56, -Math.PI / 2 - 0.44, -Math.PI / 2 + 0.44);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    } else {
      ctx.fillStyle = 'rgba(255, 65, 110, 0.2)';
      ctx.beginPath();
      ctx.arc(c.x, c.z, 46, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = sirenFlash ? '#3b9eff' : '#ff3860';
    ctx.beginPath();
    ctx.arc(c.x, c.z, c.isHeli ? 6.8 : 4.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.6;
    ctx.stroke();
  }

  ctx.restore();

  // Subtle realistic satellite GPS vignette & top horizon haze
  const topFade = ctx.createLinearGradient(0, 0, 0, 34);
  topFade.addColorStop(0, 'rgba(7, 11, 20, 0.62)');
  topFade.addColorStop(1, 'rgba(7, 11, 20, 0)');
  ctx.fillStyle = topFade;
  ctx.fillRect(0, 0, w, 34);

  const botFade = ctx.createLinearGradient(0, h - 22, 0, h);
  botFade.addColorStop(0, 'rgba(7, 11, 20, 0)');
  botFade.addColorStop(1, 'rgba(7, 11, 20, 0.42)');
  ctx.fillStyle = botFade;
  ctx.fillRect(0, h - 22, w, 22);

  // Edge-clamped crisp GTA vector landmark & objective blips
  const cosY = Math.cos(state.camYaw);
  const sinY = Math.sin(state.camYaw);
  const pad = 11;
  for (const b of state.blips) {
    const dx = (b.x - state.px) * scale;
    const dz = (b.z - state.pz) * scale;
    const rx = dx * cosY - dz * sinY;
    const ry = dx * sinY + dz * cosY;
    let bx = cx + rx;
    let by = cy + ry;
    const outOfBounds = bx < pad || bx > w - pad || by < pad || by > h - pad;
    if (outOfBounds) {
      if (b.kind !== 'goal' && b.kind !== 'story' && b.kind !== 'waypoint') {
        continue;
      }
      bx = Math.max(pad, Math.min(w - pad, bx));
      by = Math.max(pad, Math.min(h - pad, by));
    }
    drawMapBlipIcon(ctx, bx, by, b, outOfBounds ? 0.84 : 1.0);
  }

  // Player forward camera field-of-view cone + crisp GTA navigation arrow
  ctx.save();
  ctx.translate(cx, cy);
  const fovGrad = ctx.createRadialGradient(0, 0, 2, 0, 0, 44);
  fovGrad.addColorStop(0, 'rgba(255, 255, 255, 0.24)');
  fovGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
  ctx.fillStyle = fovGrad;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.arc(0, 0, 44, -Math.PI / 2 - 0.42, -Math.PI / 2 + 0.42);
  ctx.closePath();
  ctx.fill();

  ctx.rotate(state.camYaw - state.heading);
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#080b14';
  ctx.lineWidth = 2.0;
  ctx.beginPath();
  ctx.moveTo(0, -8.5);
  ctx.lineTo(-6.0, 6.2);
  ctx.lineTo(0, 3.0);
  ctx.lineTo(6.0, 6.2);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();

  // North compass indicator clamped smoothly to rectangular frame
  const ndx = Math.sin(state.camYaw);
  const ndy = -Math.cos(state.camYaw);
  const tx = ndx !== 0 ? (ndx > 0 ? (w - 11 - cx) / ndx : (11 - cx) / ndx) : 9999;
  const ty = ndy !== 0 ? (ndy > 0 ? (h - 11 - cy) / ndy : (11 - cy) / ndy) : 9999;
  const tMin = Math.min(Math.abs(tx), Math.abs(ty));
  const nx = Math.max(11, Math.min(w - 11, cx + ndx * tMin));
  const ny = Math.max(11, Math.min(h - 11, cy + ndy * tMin));
  ctx.fillStyle = 'rgba(9, 12, 20, 0.92)';
  ctx.beginPath();
  ctx.arc(nx, ny, 7.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.32)';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.fillStyle = '#ffffff';
  ctx.font = '800 9px "Barlow Condensed", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('N', nx, ny + 0.5);

  // Live GPS distance readout in bottom-right inside radar (e.g., "215m")
  if (gpsDistMeters !== null && gpsDistMeters > 8) {
    const label = gpsDistMeters >= 1000 ? `${(gpsDistMeters / 1000).toFixed(1)}km` : `${gpsDistMeters}m`;
    ctx.font = '700 10px "JetBrains Mono", monospace';
    const tw = ctx.measureText(label).width;
    ctx.fillStyle = 'rgba(9, 12, 20, 0.84)';
    ctx.fillRect(w - tw - 14, h - 19, tw + 10, 15);
    ctx.fillStyle = '#ff72b8';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, w - 9, h - 11.5);
  }

  // Flashing red/blue perimeter border when wanted
  if (state.wantedLevel > 0) {
    ctx.strokeStyle = sirenFlash ? 'rgba(59, 158, 255, 0.95)' : 'rgba(255, 46, 147, 0.95)';
    ctx.lineWidth = 2.6;
    ctx.strokeRect(1.3, 1.3, w - 2.6, h - 2.6);
  }
}

export interface FullMapMetrics {
  ox: number;
  oy: number;
  scale: number;
}

export function getFullMapMetrics(w: number, h: number): FullMapMetrics {
  const worldW = SIZE + BEACH_W + 170;
  const worldH = SIZE + 80;
  const scale = Math.min((w - 28) / worldW, (h - 28) / worldH);
  const ox = (w - worldW * scale) / 2 + (BEACH_W + 125) * scale;
  const oy = (h - worldH * scale) / 2 + 40 * scale;
  return { ox, oy, scale };
}

export function mapCanvasToWorld(
  canvasX: number,
  canvasY: number,
  w: number,
  h: number,
): { x: number; z: number } {
  const { ox, oy, scale } = getFullMapMetrics(w, h);
  return {
    x: (canvasX - ox) / scale,
    z: (canvasY - oy) / scale,
  };
}

export function drawFullCityMap(
  canvas: HTMLCanvasElement,
  state: MinimapState,
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const w = canvas.width;
  const h = canvas.height;
  const { ox, oy, scale } = getFullMapMetrics(w, h);
  const atlas = getWorldAtlas();

  ctx.fillStyle = '#09243d';
  ctx.fillRect(0, 0, w, h);

  ctx.save();
  ctx.translate(ox, oy);
  ctx.scale(scale, scale);

  // Draw the full realistic satellite & architectural city atlas
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(atlas, ATLAS_X0, ATLAS_Z0, ATLAS_WORLD_W, ATLAS_WORLD_H);

  // Stunt ramps
  for (const r of STUNT_RAMPS) {
    ctx.fillStyle = '#090c14';
    ctx.beginPath();
    ctx.arc(r.x, r.z, 7.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#00f0d8';
    ctx.beginPath();
    ctx.arc(r.x, r.z, 5.2, 0, Math.PI * 2);
    ctx.fill();
  }

  // GPS Route Line
  if (state.gpsTarget) {
    const pts = route(state.px, state.pz, state.gpsTarget.x, state.gpsTarget.z);
    if (pts.length > 1) {
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = 'rgba(8, 10, 18, 0.88)';
      ctx.lineWidth = 9;
      ctx.beginPath();
      ctx.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
      ctx.stroke();

      ctx.strokeStyle = state.gpsTarget.color || '#ff2e93';
      ctx.lineWidth = 5.5;
      ctx.beginPath();
      ctx.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
      ctx.stroke();
    }
  }

  // Blips
  for (const b of state.blips) {
    drawMapBlipIcon(ctx, b.x, b.z, b, 1.55);
  }

  // Player directional chevron
  ctx.save();
  ctx.translate(state.px, state.pz);
  ctx.rotate(-state.heading);
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#090d15';
  ctx.lineWidth = 2.8;
  ctx.beginPath();
  ctx.moveTo(0, -15);
  ctx.lineTo(-10.5, 10.5);
  ctx.lineTo(0, 5.2);
  ctx.lineTo(10.5, 10.5);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();

  ctx.restore();

  // Crisp cartographic district labels with dark readability halo
  const labels: Array<[string, number, number]> = [
    ['SUNSET BEACH', -36, 130],
    ['OCEAN DRIVE', 96, 286],
    ['PALM HEIGHTS', 250, 56],
    ['DOWNTOWN VICE', 288, 250],
    ['NEON STRIP', 250, 512],
    ['HARBOR DOCKS', 504, 290],
  ];
  ctx.font = '800 11px "Barlow Condensed", sans-serif';
  ctx.textAlign = 'center';
  ctx.lineWidth = 3.2;
  ctx.strokeStyle = 'rgba(7, 10, 18, 0.88)';
  ctx.fillStyle = 'rgba(248, 250, 255, 0.94)';
  for (const [text, wx, wz] of labels) {
    const lx = ox + wx * scale;
    const ly = oy + wz * scale;
    ctx.strokeText(text, lx, ly);
    ctx.fillText(text, lx, ly);
  }
}
