// CityLayout: Vice Coast's grid, districts, English street names, lots, stunt ramps, tree validation, and GPS routes.
export const BLOCK = 72;
export const ROAD = 16;
export const GRID = 8;
export const LANE = 3.6;
export const WALK = 4;
export const SIZE = GRID * BLOCK; // 576 m from Ocean Drive to Harbor Way
export const BEACH_W = 56;
export const SEA_X = -ROAD / 2 - BEACH_W; // sand from x=-8 to x=-64, sea beyond
export const PIER_Z = 3 * BLOCK + 36; // Vice Lighthouse Pier

export type DistrictKey = 'malecon' | 'heights' | 'downtown' | 'neon' | 'port' | 'beach';

export interface DistrictInfo {
  name: string;
  color: string;
  map: string;
}

export const DISTRICTS: Record<DistrictKey, DistrictInfo> = {
  malecon: { name: 'Ocean Drive', color: '#ff6ca8', map: '#3d2848' },
  heights: { name: 'Palm Heights', color: '#00f0d8', map: '#1f4246' },
  downtown: { name: 'Downtown Vice', color: '#60b8ff', map: '#233454' },
  neon: { name: 'Neon Strip', color: '#ff2e93', map: '#461e4b' },
  port: { name: 'Harbor Docks', color: '#ff9b54', map: '#3b333f' },
  beach: { name: 'Sunset Beach', color: '#ffd36e', map: '#52463a' },
};

export const AVENUES = [
  'Ocean Drive',
  'Coral Avenue',
  'Breeze Street',
  'Crystal Avenue',
  'Moonlight Blvd',
  'Lighthouse Ave',
  'Anchor Street',
  'Dockside Road',
  'Harbor Way',
];

export const STREETS = [
  'North Blvd',
  'Palm Drive',
  'Sunburst Ave',
  'Bay Street',
  'Tide Street',
  'Neon Blvd',
  'Surf Avenue',
  'South Street',
  'Harbor Road',
];

export interface StuntRampDef {
  id: string;
  name: string;
  x: number;
  z: number;
  heading: number; // direction car travels UP the ramp (0 = -Z north, Math.PI = +Z south)
  width: number;
  length: number;
  height: number;
}

// Six cleanly road-aligned boulevard, beach, downtown, neon strip, and dockside stunt ramps
export const STUNT_RAMPS: readonly StuntRampDef[] = [
  { id: 'malecon-north', name: 'Ocean Drive Launch', x: 0, z: 324, heading: 0, width: 5.4, length: 11, height: 2.6 },
  { id: 'malecon-south', name: 'Boardwalk Hopper', x: -34, z: 185, heading: Math.PI, width: 5.2, length: 10, height: 2.5 },
  { id: 'cristal-plaza', name: 'Crystal Overpass', x: 216, z: 180, heading: 0, width: 5.2, length: 11, height: 2.7 },
  { id: 'neon-strip', name: 'Neon Strip Leap', x: 288, z: 468, heading: 0, width: 5.4, length: 10.5, height: 2.5 },
  { id: 'port-crane', name: 'Harbor Crane Jump', x: 504, z: 252, heading: 0, width: 5.6, length: 11.5, height: 2.9 },
  { id: 'palm-crest', name: 'Palm Crest Launch', x: 324, z: 72, heading: Math.PI / 2, width: 5.2, length: 10, height: 2.5 },
];

export interface LotDef {
  bx: number;
  bz: number;
  x0: number;
  z0: number;
  x1: number;
  z1: number;
  district: DistrictKey;
}

export function blockDistrict(bx: number, bz: number): DistrictKey {
  if (bx >= 6) return 'port';
  if (bz <= 1) return 'heights';
  if (bx <= 1) return 'malecon';
  if (bz >= 5) return 'neon';
  return 'downtown';
}

export function districtAt(x: number, z: number): DistrictKey {
  if (x < -ROAD / 2) return 'beach';
  const bx = Math.max(0, Math.min(GRID - 1, Math.floor(x / BLOCK)));
  const bz = Math.max(0, Math.min(GRID - 1, Math.floor(z / BLOCK)));
  return blockDistrict(bx, bz);
}

export function streetAt(x: number, z: number): string {
  const kx = Math.round(x / BLOCK);
  const kz = Math.round(z / BLOCK);
  const dx = Math.abs(x - kx * BLOCK);
  const dz = Math.abs(z - kz * BLOCK);
  if (dx < dz && kx >= 0 && kx <= GRID) return AVENUES[kx];
  if (kz >= 0 && kz <= GRID) return STREETS[kz];
  return AVENUES[0];
}

export function lots(): LotDef[] {
  const out: LotDef[] = [];
  for (let bx = 0; bx < GRID; bx++) {
    for (let bz = 0; bz < GRID; bz++) {
      const x0 = bx * BLOCK + ROAD / 2;
      const z0 = bz * BLOCK + ROAD / 2;
      out.push({
        bx,
        bz,
        x0,
        z0,
        x1: x0 + BLOCK - ROAD,
        z1: z0 + BLOCK - ROAD,
        district: blockDistrict(bx, bz),
      });
    }
  }
  return out;
}

export function onRoad(x: number, z: number): boolean {
  const fx = Math.abs(x - Math.round(x / BLOCK) * BLOCK);
  const fz = Math.abs(z - Math.round(z / BLOCK) * BLOCK);
  const inside =
    x > -ROAD / 2 && x < SIZE + ROAD / 2 && z > -ROAD / 2 && z < SIZE + ROAD / 2;
  return inside && (fx < ROAD / 2 || fz < ROAD / 2);
}

// Pure validation rule ensuring palm trees never clip roads, intersections, crosswalks,
// the pier entrance, stunt ramps, or the ocean surf.
export function isValidTreeSpot(x: number, z: number): boolean {
  // Never spawn in the ocean or wet surf zone
  if (x < SEA_X + 7) return false;

  // Never block the Vice Lighthouse Pier approach & promenade opening
  if (x < 0 && Math.abs(z - PIER_Z) < 12) return false;

  // Never spawn inside roads, curb aprons, intersections, or crosswalk zones
  const inGridX = x > -ROAD / 2 - 1.2 && x < SIZE + ROAD / 2 + 1.2;
  const inGridZ = z > -ROAD / 2 - 1.2 && z < SIZE + ROAD / 2 + 1.2;
  if (inGridX && inGridZ) {
    const fx = Math.abs(x - Math.round(x / BLOCK) * BLOCK);
    const fz = Math.abs(z - Math.round(z / BLOCK) * BLOCK);
    if (fx < ROAD / 2 + 1.0 || fz < ROAD / 2 + 1.0) return false;
    // Also keep clear of intersection crosswalk corners (within 13m of intersection center)
    if (fx < ROAD / 2 + 5.0 && fz < ROAD / 2 + 5.0) return false;
  }

  // Never spawn on or near stunt ramp launch/landing corridors
  for (const r of STUNT_RAMPS) {
    if (Math.hypot(x - r.x, z - r.z) < 13) return false;
  }

  return true;
}

export interface RoadAnchor {
  x: number;
  z: number;
  axis: 'x' | 'z';
  k: number;
}

export function nearestRoad(x: number, z: number): RoadAnchor {
  const kx = Math.max(0, Math.min(GRID, Math.round(x / BLOCK)));
  const kz = Math.max(0, Math.min(GRID, Math.round(z / BLOCK)));
  const cz = Math.max(0, Math.min(SIZE, z));
  const cx = Math.max(0, Math.min(SIZE, x));
  const a: RoadAnchor = { x: kx * BLOCK, z: cz, axis: 'z', k: kx };
  const b: RoadAnchor = { x: cx, z: kz * BLOCK, axis: 'x', k: kz };
  return Math.hypot(a.x - x, a.z - z) < Math.hypot(b.x - x, b.z - z) ? a : b;
}

// Compute ramp height and launch slope at world point (x, z)
export function sampleStuntRamp(
  x: number,
  z: number,
): { ramp: StuntRampDef; height: number; progress: number } | null {
  for (const r of STUNT_RAMPS) {
    const dx = x - r.x;
    const dz = z - r.z;
    const fx = -Math.sin(r.heading);
    const fz = -Math.cos(r.heading);
    const rx = -fz;
    const rz = fx;
    const along = dx * fx + dz * fz; // -length/2 (entry) to +length/2 (lip)
    const across = dx * rx + dz * rz;
    if (Math.abs(across) <= r.width * 0.56 && Math.abs(along) <= r.length * 0.52) {
      const progress = Math.max(0, Math.min(1, (along + r.length / 2) / r.length));
      return { ramp: r, height: progress * r.height, progress };
    }
  }
  return null;
}

// GPS: breadth-first search over the 9x9 intersections, returned as world points.
export function route(
  fx: number,
  fz: number,
  tx: number,
  tz: number,
): [number, number][] {
  const s = nearestRoad(fx, fz);
  const t = nearestRoad(tx, tz);
  const node = (x: number, z: number): [number, number] => [
    Math.max(0, Math.min(GRID, Math.round(x / BLOCK))),
    Math.max(0, Math.min(GRID, Math.round(z / BLOCK))),
  ];
  const [sx, sz] = node(s.x, s.z);
  const [ex, ez] = node(t.x, t.z);
  const key = (a: number, b: number) => a * 16 + b;
  const prev = new Map<number, [number, number] | null>([[key(sx, sz), null]]);
  const q: [number, number][] = [[sx, sz]];

  while (q.length) {
    const [a, b] = q.shift()!;
    if (a === ex && b === ez) break;
    for (const [da, db] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const na = a + da;
      const nb = b + db;
      if (na < 0 || nb < 0 || na > GRID || nb > GRID || prev.has(key(na, nb))) continue;
      prev.set(key(na, nb), [a, b]);
      q.push([na, nb]);
    }
  }

  const pts: [number, number][] = [[t.x, t.z]];
  let cur: [number, number] | null | undefined = [ex, ez];
  while (cur) {
    pts.push([cur[0] * BLOCK, cur[1] * BLOCK]);
    cur = prev.get(key(cur[0], cur[1]));
  }
  pts.push([s.x, s.z], [fx, fz]);
  return pts.reverse();
}
