import { SEA_X, SIZE } from './CityLayout.ts';

const CELL = 24;

export interface SolidVolume {
  x0: number;
  z0: number;
  x1: number;
  z1: number;
  h: number;
  circle?: { x: number; z: number; r: number };
}

export interface ResolveResult {
  x: number;
  z: number;
  hit: boolean;
  nx: number;
  nz: number;
}

export class Collision {
  private grid = new Map<number, SolidVolume[]>();
  public boxes: SolidVolume[] = [];

  private key(cx: number, cz: number): number {
    return cx * 4096 + cz;
  }

  addBox(x0: number, z0: number, x1: number, z1: number, h = 10): void {
    this.insert({ x0, z0, x1, z1, h });
  }

  addCircle(x: number, z: number, r: number, h = 4): void {
    this.insert({
      x0: x - r,
      z0: z - r,
      x1: x + r,
      z1: z + r,
      h,
      circle: { x, z, r },
    });
  }

  private insert(b: SolidVolume): void {
    this.boxes.push(b);
    for (let cx = Math.floor(b.x0 / CELL); cx <= Math.floor(b.x1 / CELL); cx++) {
      for (let cz = Math.floor(b.z0 / CELL); cz <= Math.floor(b.z1 / CELL); cz++) {
        const k = this.key(cx, cz);
        let list = this.grid.get(k);
        if (!list) {
          list = [];
          this.grid.set(k, list);
        }
        list.push(b);
      }
    }
  }

  near(x: number, z: number): SolidVolume[] {
    return this.grid.get(this.key(Math.floor(x / CELL), Math.floor(z / CELL))) ?? [];
  }

  resolve(x: number, z: number, r: number): ResolveResult {
    let hit = false;
    let nx = 0;
    let nz = 0;

    for (let pass = 0; pass < 2; pass++) {
      for (const b of this.near(x, z)) {
        if (b.circle) {
          const dx = x - b.circle.x;
          const dz = z - b.circle.z;
          const d = Math.hypot(dx, dz);
          const m = b.circle.r + r;
          if (d >= m || d === 0) continue;
          x = b.circle.x + (dx / d) * m;
          z = b.circle.z + (dz / d) * m;
          nx = dx / d;
          nz = dz / d;
          hit = true;
          continue;
        }
        const px = Math.max(b.x0, Math.min(x, b.x1));
        const pz = Math.max(b.z0, Math.min(z, b.z1));
        const dx = x - px;
        const dz = z - pz;
        const d = Math.hypot(dx, dz);
        if (d >= r) continue;
        if (d > 1e-4) {
          x = px + (dx / d) * r;
          z = pz + (dz / d) * r;
          nx = dx / d;
          nz = dz / d;
        } else {
          const sides: [number, number, number][] = [
            [x - b.x0, -1, 0],
            [b.x1 - x, 1, 0],
            [z - b.z0, 0, -1],
            [b.z1 - z, 0, 1],
          ];
          sides.sort((a, c) => a[0] - c[0]);
          const o = sides[0];
          x += o[1] * (o[0] + r);
          z += o[2] * (o[0] + r);
          nx = o[1];
          nz = o[2];
        }
        hit = true;
      }
    }

    const minX = SEA_X + 2;
    const max = SIZE + 40;
    const min = -40;
    if (x < minX) {
      x = minX;
      hit = true;
      nx = 1;
      nz = 0;
    }
    if (x > max) {
      x = max;
      hit = true;
      nx = -1;
    }
    if (z < min) {
      z = min;
      hit = true;
      nz = 1;
    }
    if (z > max) {
      z = max;
      hit = true;
      nz = -1;
    }
    return { x, z, hit, nx, nz };
  }

  ray(x: number, z: number, dx: number, dz: number, maxD: number, y = 1.2): number {
    const step = 1.5;
    for (let t = 0; t < maxD; t += step) {
      const px = x + dx * t;
      const pz = z + dz * t;
      for (const b of this.near(px, pz)) {
        if (b.h < y) continue;
        if (b.circle) {
          if (Math.hypot(px - b.circle.x, pz - b.circle.z) < b.circle.r) return t;
        } else if (px > b.x0 && px < b.x1 && pz > b.z0 && pz < b.z1) {
          return t;
        }
      }
    }
    return Infinity;
  }

  clearLine(ax: number, az: number, bx: number, bz: number): boolean {
    const d = Math.hypot(bx - ax, bz - az);
    return d < 1 || this.ray(ax, az, (bx - ax) / d, (bz - az) / d, d) === Infinity;
  }
}
