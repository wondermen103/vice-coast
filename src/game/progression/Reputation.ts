// Reputation: Street Respect tiers, payout multiplier, and pure helper functions.
export const REP_TIERS = [
  { level: 1, min: 0, title: 'Boardwalk Runner' },
  { level: 2, min: 150, title: 'Sunset Wheelman' },
  { level: 3, min: 400, title: 'Pier Regular' },
  { level: 4, min: 750, title: 'Neon Broker' },
  { level: 5, min: 1200, title: 'Downtown Fixer' },
  { level: 6, min: 1800, title: 'Vice Coast Legend' },
] as const;

export function reputationLevel(points: number): number {
  let lv = 1;
  for (const t of REP_TIERS) {
    if (points >= t.min) lv = t.level;
  }
  return lv;
}

export function reputationTitle(level: number): string {
  const entry = REP_TIERS.find((t) => t.level === level) ?? REP_TIERS[0];
  return entry.title;
}

export function reputationBonus(level: number): number {
  return 1 + Math.max(0, level - 1) * 0.08;
}

export function reputationProgress(points: number): number {
  const lv = reputationLevel(points);
  const cur = REP_TIERS.find((t) => t.level === lv)!;
  const next = REP_TIERS.find((t) => t.level === lv + 1);
  if (!next) return 1;
  return Math.max(0, Math.min(1, (points - cur.min) / (next.min - cur.min)));
}

export class Reputation {
  public points = 0;

  constructor(private G: any) {}

  get level(): number {
    return reputationLevel(this.points);
  }

  get title(): string {
    return reputationTitle(this.level);
  }

  get bonus(): number {
    return reputationBonus(this.level);
  }

  get progress(): number {
    return reputationProgress(this.points);
  }

  earn(n: number, _reason?: string): void {
    const prev = this.level;
    this.points += Math.max(0, Math.round(n));
    const next = this.level;
    if (next > prev) {
      this.G.ui?.missionBanner(
        `RESPECT RANK ${next}`,
        `${this.title} · +${Math.round((this.bonus - 1) * 100)}% Job Payouts`,
        'pass',
      );
      this.G.audio?.fanfare();
    }
  }
}
