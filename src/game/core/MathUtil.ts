export const clamp = (v: number, a: number, b: number): number =>
  v < a ? a : v > b ? b : v;

export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

export const smooth = (t: number): number => t * t * (3 - 2 * t);

export const damp = (a: number, b: number, lambda: number, dt: number): number =>
  lerp(a, b, 1 - Math.exp(-lambda * dt));

export function wrapAngle(a: number): number {
  let r = (a + Math.PI) % (Math.PI * 2);
  if (r < 0) r += Math.PI * 2;
  return r - Math.PI;
}

export function formatMoney(n: number): string {
  return '$' + Math.round(n).toLocaleString('en-US');
}

export class Rng {
  private s: number;

  constructor(seed = 1) {
    this.s = seed >>> 0 || 1;
  }

  next(): number {
    let t = (this.s += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  range(a: number, b: number): number {
    return a + (b - a) * this.next();
  }

  int(a: number, b: number): number {
    return Math.floor(this.range(a, b + 1));
  }

  chance(p: number): boolean {
    return this.next() < p;
  }

  pick<T>(arr: readonly T[]): T {
    return arr[Math.floor(this.next() * arr.length)];
  }
}

export function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export class Emitter {
  private map = new Map<string, Array<(payload: any) => void>>();

  on(event: string, fn: (payload: any) => void): void {
    let list = this.map.get(event);
    if (!list) {
      list = [];
      this.map.set(event, list);
    }
    list.push(fn);
  }

  emit(event: string, payload?: any): void {
    const list = this.map.get(event);
    if (!list) return;
    for (const fn of list) fn(payload);
  }
}

