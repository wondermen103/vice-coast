// WantedSystem: 5-star heat accumulation, line-of-sight evasion timer, and pure threshold helpers.
import { clamp } from '../core/MathUtil.ts';

export const WANTED_THRESHOLDS = [0, 12, 34, 70, 120, 185] as const;

export const CRIME_HEAT: Record<string, number> = {
  carjack: 14,
  theft: 10,
  stealCop: 36,
  assault: 12,
  gunfire: 8,
  hitPed: 15,
  killPed: 24,
  hitCop: 32,
  killCop: 52,
  explosion: 35,
  heist: 48,
};

export function computeWantedLevel(heat: number): number {
  let lv = 0;
  for (let i = 1; i < WANTED_THRESHOLDS.length; i++) {
    if (heat >= WANTED_THRESHOLDS[i]) lv = i;
  }
  return lv;
}

export function evadeDuration(level: number): number {
  if (level <= 0) return 0;
  return 10 + level * 5;
}

export class WantedSystem {
  public heat = 0;
  public level = 0;
  public seen = false;
  public evadeT = 0;
  public lastSeen = { x: 0, z: 0 };

  constructor(private G: any) {}

  crime(kind: string, x: number, z: number): void {
    const add = CRIME_HEAT[kind] ?? 10;
    const prev = this.level;
    this.heat = clamp(this.heat + add, 0, 240);
    const next = computeWantedLevel(this.heat);
    this.level = Math.max(this.level, next);
    this.seen = true;
    this.evadeT = 0;
    this.lastSeen = { x, z };
    if (this.level > prev) {
      this.G.ui?.wantedUp(this.level);
      this.G.audio?.wantedUp();
    }
  }

  raise(minLevel: number): void {
    const prev = this.level;
    this.level = Math.max(this.level, clamp(minLevel, 0, 5));
    this.heat = Math.max(this.heat, WANTED_THRESHOLDS[this.level] + 5);
    this.seen = true;
    this.evadeT = 0;
    if (this.level > prev) {
      this.G.ui?.wantedUp(this.level);
      this.G.audio?.wantedUp();
    }
  }

  clear(): void {
    this.heat = 0;
    this.level = 0;
    this.seen = false;
    this.evadeT = 0;
    this.G.police?.clear();
  }

  update(dt: number): void {
    if (this.level <= 0) return;
    const G = this.G;
    const P = G.player;

    let spotted = false;
    for (const u of G.police.units) {
      if (u.dead) continue;
      if (
        Math.hypot(u.x - P.x, u.z - P.z) < 52 &&
        G.collision.clearLine(u.x, u.z, P.x, P.z)
      ) {
        spotted = true;
        break;
      }
    }
    if (!spotted) {
      for (const o of G.police.officers) {
        if (o.dead) continue;
        if (
          Math.hypot(o.x - P.x, o.z - P.z) < 38 &&
          G.collision.clearLine(o.x, o.z, P.x, P.z)
        ) {
          spotted = true;
          break;
        }
      }
    }
    if (!spotted && G.police.heli.active) {
      if (Math.hypot(G.police.heli.x - P.x, G.police.heli.z - P.z) < 62) {
        spotted = true;
      }
    }

    this.seen = spotted;
    if (spotted) {
      this.evadeT = 0;
      this.lastSeen = { x: P.x, z: P.z };
    } else {
      this.evadeT += dt;
      if (this.evadeT >= evadeDuration(this.level)) {
        const prev = this.level;
        this.clear();
        G.rep?.earn(prev * 25);
        G.ui?.toast(`VCPD EVADED · RESPECT +${prev * 25}`, 'good');
      }
    }
  }
}
