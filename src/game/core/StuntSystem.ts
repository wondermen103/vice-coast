import { clamp } from './MathUtil.ts';

export interface StuntState {
  nitro: number; // 0..100
  boosting: boolean;
  comboPoints: number;
  comboMult: number;
  comboTimer: number;
  activeLabel: string;
  airtime: number;
  airStartDist: number;
  peakHeight: number;
  nearMissCooldown: number;
  totalDrifts: number;
  totalJumps: number;
  bestJumpMeters: number;
}

export interface StuntTickInput {
  dt: number;
  speed: number; // m/s forward speed
  lateralSpeed: number; // m/s lateral slip
  airborne: boolean;
  height: number;
  wantNitro: boolean;
  nitroTier: number; // 0..3
  handbrake: boolean;
  crashedHard: boolean;
}

export interface StuntEvent {
  kind: 'bank' | 'jump' | 'nearMiss';
  label: string;
  cash: number;
  respect: number;
  meters?: number;
}

export function createStuntState(): StuntState {
  return {
    nitro: 65,
    boosting: false,
    comboPoints: 0,
    comboMult: 1,
    comboTimer: 0,
    activeLabel: '',
    airtime: 0,
    airStartDist: 0,
    peakHeight: 0,
    nearMissCooldown: 0,
    totalDrifts: 0,
    totalJumps: 0,
    bestJumpMeters: 0,
  };
}

export function stepStuntState(
  state: StuntState,
  input: StuntTickInput,
): { events: StuntEvent[]; nitroMultiplier: number } {
  const events: StuntEvent[] = [];
  const absSpd = Math.abs(input.speed);
  const absLat = Math.abs(input.lateralSpeed);
  const dt = clamp(input.dt, 0, 0.05);

  state.nearMissCooldown = Math.max(0, state.nearMissCooldown - dt);

  // Hard crash resets unbanked combo
  if (input.crashedHard && state.comboPoints > 0) {
    state.comboPoints = 0;
    state.comboMult = 1;
    state.comboTimer = 0;
    state.activeLabel = '';
  }

  // Nitrous consumption & passive trickle recharge
  const drainRate = 28 - input.nitroTier * 3.5;
  const passiveRate = 2.6 + input.nitroTier * 1.4;
  const canBoost =
    input.wantNitro &&
    !input.airborne &&
    input.speed > 4 &&
    (state.boosting ? state.nitro > 1 : state.nitro >= 10);

  if (canBoost) {
    state.boosting = true;
    state.nitro = clamp(state.nitro - drainRate * dt, 0, 100);
  } else {
    state.boosting = false;
    state.nitro = clamp(state.nitro + passiveRate * dt, 0, 100);
  }

  // Drifting builds combo + recharges nitrous rapidly
  const isDrifting =
    !input.airborne && absSpd > 10 && (absLat > 2.8 || (input.handbrake && absLat > 1.7));
  if (isDrifting) {
    const rate = (absLat * 14 + absSpd * 2.2) * (1 + input.nitroTier * 0.12);
    state.comboPoints += rate * dt;
    state.comboTimer = 2.4;
    state.activeLabel = absLat > 5.5 ? 'SUPER DRIFT' : 'DRIFT';
    state.nitro = clamp(state.nitro + (14 + input.nitroTier * 3) * dt, 0, 100);
    state.comboMult = clamp(1 + Math.floor(state.comboPoints / 220), 1, 5);
  }

  // Airborne stunt jump tracking
  if (input.airborne) {
    state.airtime += dt;
    state.airStartDist += absSpd * dt;
    state.peakHeight = Math.max(state.peakHeight, input.height);
    if (state.airtime > 0.25) {
      state.comboPoints += (absSpd * 3.5 + input.height * 18) * dt;
      state.comboTimer = 2.6;
      state.activeLabel = 'AIRTIME';
      state.nitro = clamp(state.nitro + 18 * dt, 0, 100);
    }
  } else if (state.airtime > 0) {
    // Just landed
    if (state.airtime >= 0.42 && state.airStartDist >= 10) {
      const meters = Math.round(state.airStartDist);
      const jumpCash = Math.round(meters * 14 + state.peakHeight * 45);
      const jumpRep = Math.max(8, Math.round(meters * 0.45));
      state.totalJumps += 1;
      state.bestJumpMeters = Math.max(state.bestJumpMeters, meters);
      state.comboPoints += meters * 12;
      state.comboMult = clamp(state.comboMult + 1, 1, 5);
      state.comboTimer = 2.8;
      state.activeLabel = `STUNT JUMP · ${meters}M`;
      events.push({
        kind: 'jump',
        label: meters >= 34 ? `INSANE STUNT · ${meters}m` : `STUNT JUMP · ${meters}m`,
        cash: jumpCash,
        respect: jumpRep,
        meters,
      });
    }
    state.airtime = 0;
    state.airStartDist = 0;
    state.peakHeight = 0;
  }

  // Combo countdown & banking
  if (state.comboTimer > 0 && !isDrifting && !input.airborne) {
    state.comboTimer -= dt;
    if (state.comboTimer <= 0) {
      const raw = Math.round(state.comboPoints);
      if (raw >= 80) {
        const cash = Math.round(raw * 0.45 * state.comboMult);
        const respect = Math.max(3, Math.round((raw * state.comboMult) / 95));
        state.totalDrifts += 1;
        events.push({
          kind: 'bank',
          label: `STYLE COMBO x${state.comboMult}`,
          cash,
          respect,
        });
      }
      state.comboPoints = 0;
      state.comboMult = 1;
      state.comboTimer = 0;
      state.activeLabel = '';
    }
  }

  const nitroMultiplier = state.boosting ? 1.32 + input.nitroTier * 0.06 : 1;
  return { events, nitroMultiplier };
}

export function registerNearMiss(
  state: StuntState,
  speed: number,
  nitroTier: number,
): StuntEvent | null {
  if (state.nearMissCooldown > 0 || Math.abs(speed) < 19) return null;
  state.nearMissCooldown = 1.1;
  state.nitro = clamp(state.nitro + 16 + nitroTier * 3, 0, 100);
  state.comboPoints += 120;
  state.comboMult = clamp(state.comboMult + 1, 1, 5);
  state.comboTimer = 2.6;
  state.activeLabel = 'NEAR MISS';
  return {
    kind: 'nearMiss',
    label: 'NEAR MISS',
    cash: 65 * state.comboMult,
    respect: 4,
  };
}
