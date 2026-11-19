// SaveGame: localStorage persistence for Puerto Celeste progress, arsenal, stunts, and weather.
import type { WeatherMode } from '../core/WeatherRules.ts';

const KEY = 'ghk_puerto_celeste_v2';

export interface SaveData {
  money: number;
  rep: number;
  done: string[];
  conches: number[];
  owned: Record<string, boolean>;
  ammo: Record<string, number>;
  armor: number;
  weather: WeatherMode;
  totalDrifts: number;
  totalJumps: number;
  bestJumpMeters: number;
  savedAt: number;
}

export class SaveGame {
  constructor(private G: any) {}

  hasSave(): boolean {
    try {
      return !!localStorage.getItem(KEY);
    } catch {
      return false;
    }
  }

  save(): boolean {
    try {
      const G = this.G;
      const data: SaveData = {
        money: G.economy.money,
        rep: G.rep.points,
        done: [...G.missions.done],
        conches: [...G.missions.conches],
        owned: { ...G.combat.owned },
        ammo: { ...G.combat.ammo },
        armor: G.player.armor,
        weather: G.sky.weather,
        totalDrifts: G.player.stunt.totalDrifts,
        totalJumps: G.player.stunt.totalJumps,
        bestJumpMeters: G.player.stunt.bestJumpMeters,
        savedAt: Date.now(),
      };
      localStorage.setItem(KEY, JSON.stringify(data));
      return true;
    } catch {
      return false;
    }
  }

  load(): boolean {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return false;
      const data = JSON.parse(raw) as SaveData;
      const G = this.G;
      G.economy.money = data.money ?? 2400;
      G.rep.points = data.rep ?? 0;
      G.missions.done = Array.isArray(data.done) ? [...data.done] : [];
      G.missions.conches = new Set(Array.isArray(data.conches) ? data.conches : []);
      G.combat.owned = { fists: true, pistol: true, ...(data.owned ?? {}) };
      G.combat.ammo = { pistol: 72, ...(data.ammo ?? {}) };
      G.player.armor = data.armor ?? 0;
      if (data.weather) G.sky.setWeather(data.weather);
      G.player.stunt.totalDrifts = data.totalDrifts ?? 0;
      G.player.stunt.totalJumps = data.totalJumps ?? 0;
      G.player.stunt.bestJumpMeters = data.bestJumpMeters ?? 0;
      return true;
    } catch {
      return false;
    }
  }

  clear(): void {
    try {
      localStorage.removeItem(KEY);
    } catch {}
  }
}
