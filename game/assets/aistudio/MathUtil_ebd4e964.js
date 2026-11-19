// Small deterministic math helpers shared by every system (seeded RNG, damping, angles).
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const damp = (a, b, lambda, dt) => lerp(a, b, 1 - Math.exp(-lambda * dt));
export const wrapAngle = (a) => Math.atan2(Math.sin(a), Math.cos(a));
export const dist2 = (ax, az, bx, bz) => (ax - bx) * (ax - bx) + (az - bz) * (az - bz);
export const smooth = (t) => t * t * (3 - 2 * t);

export function hash2(x, z) {
    let h = Math.imul(x | 0, 374761393) ^ Math.imul(z | 0, 668265263);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

export class Rng {
    constructor(seed = 1) {
        this.s = seed >>> 0;
    }
    next() {
        this.s = (this.s + 0x6d2b79f5) >>> 0;
        let t = this.s;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }
    range(a, b) {
        return a + (b - a) * this.next();
    }
    int(a, b) {
        return Math.floor(this.range(a, b + 1));
    }
    pick(list) {
        return list[Math.floor(this.next() * list.length)];
    }
    chance(p) {
        return this.next() < p;
    }
}

export function formatMoney(n) {
    return '$' + Math.round(n).toLocaleString('en-US');
}