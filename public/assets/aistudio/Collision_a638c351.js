// Collision: boxes and circles in a spatial hash; circle push-out and ray casts (bullets, line of sight).
import {
    SEA_X,
    SIZE
} from './CityLayout.js';

const CELL = 24;
export class Collision {
    constructor() {
        this.grid = new Map();
        this.boxes = [];
    }
    key(cx, cz) {
        return cx * 4096 + cz;
    }

    addBox(x0, z0, x1, z1, h = 10) {
        this.insert({
            x0,
            z0,
            x1,
            z1,
            h
        });
    }
    addCircle(x, z, r, h = 4) {
        this.insert({
            x0: x - r,
            z0: z - r,
            x1: x + r,
            z1: z + r,
            h,
            circle: {
                x,
                z,
                r
            }
        });
    }
    insert(b) {
        this.boxes.push(b);
        for (let cx = Math.floor(b.x0 / CELL); cx <= Math.floor(b.x1 / CELL); cx++)
            for (let cz = Math.floor(b.z0 / CELL); cz <= Math.floor(b.z1 / CELL); cz++) {
                const k = this.key(cx, cz);
                if (!this.grid.has(k)) this.grid.set(k, []);
                this.grid.get(k).push(b);
            }
    }
    near(x, z) {
        return this.grid.get(this.key(Math.floor(x / CELL), Math.floor(z / CELL))) || [];
    }

    // Pushes a circle out of every solid it overlaps. Returns {x, z, hit, nx, nz}.
    resolve(x, z, r) {
        let hit = false,
            nx = 0,
            nz = 0;
        for (let pass = 0; pass < 2; pass++)
            for (const b of this.near(x, z)) {
                let px, pz, dx, dz, d;
                if (b.circle) {
                    dx = x - b.circle.x;
                    dz = z - b.circle.z;
                    d = Math.hypot(dx, dz);
                    const m = b.circle.r + r;
                    if (d >= m || d === 0) continue;
                    x = b.circle.x + dx / d * m;
                    z = b.circle.z + dz / d * m;
                    nx = dx / d;
                    nz = dz / d;
                    hit = true;
                    continue;
                }
                px = Math.max(b.x0, Math.min(x, b.x1));
                pz = Math.max(b.z0, Math.min(z, b.z1));
                dx = x - px;
                dz = z - pz;
                d = Math.hypot(dx, dz);
                if (d >= r) continue;
                if (d > 1e-4) {
                    x = px + dx / d * r;
                    z = pz + dz / d * r;
                    nx = dx / d;
                    nz = dz / d;
                } else { // centre inside the box: leave by the nearest side
                    const o = [
                        [x - b.x0, -1, 0],
                        [b.x1 - x, 1, 0],
                        [z - b.z0, 0, -1],
                        [b.z1 - z, 0, 1]
                    ].sort((a, c) => a[0] - c[0])[0];
                    x += o[1] * (o[0] + r);
                    z += o[2] * (o[0] + r);
                    nx = o[1];
                    nz = o[2];
                }
                hit = true;
            }
        // World edges: the sea to the west, a low dune wall around the rest of the city.
        const minX = SEA_X + 2,
            max = SIZE + 40,
            min = -40;
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
        return {
            x,
            z,
            hit,
            nx,
            nz
        };
    }

    // Distance along a 2D ray to the first solid taller than y (Infinity when clear).
    ray(x, z, dx, dz, maxD, y = 1.2) {
        const step = 1.5;
        for (let t = 0; t < maxD; t += step) {
            const px = x + dx * t,
                pz = z + dz * t;
            for (const b of this.near(px, pz)) {
                if (b.h < y) continue;
                if (b.circle) {
                    if (Math.hypot(px - b.circle.x, pz - b.circle.z) < b.circle.r) return t;
                } else if (px > b.x0 && px < b.x1 && pz > b.z0 && pz < b.z1) return t;
            }
        }
        return Infinity;
    }
    clearLine(ax, az, bx, bz) {
        const d = Math.hypot(bx - ax, bz - az);
        return d < 1 || this.ray(ax, az, (bx - ax) / d, (bz - az) / d, d) === Infinity;
    }
}