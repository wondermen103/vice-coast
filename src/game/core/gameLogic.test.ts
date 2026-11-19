import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BLOCK,
  PIER_Z,
  STUNT_RAMPS,
  districtAt,
  isValidTreeSpot,
  route,
  sampleStuntRamp,
  streetAt,
} from '../world/CityLayout.ts';
import { Collision } from '../world/Collision.ts';
import {
  createStuntState,
  registerNearMiss,
  stepStuntState,
} from './StuntSystem.ts';
import {
  WEATHER_ORDER,
  WEATHER_SPECS,
  nextWeatherMode,
} from './WeatherRules.ts';
import {
  computeWantedLevel,
  evadeDuration,
} from '../police/WantedSystem.ts';
import {
  reputationBonus,
  reputationLevel,
  reputationTitle,
} from '../progression/Reputation.ts';

test('CityLayout resolves Vice Coast English districts, streets, BFS routes, and road-aligned stunt ramps', () => {
  assert.equal(districtAt(-30, 180), 'beach');
  assert.equal(districtAt(40, 200), 'malecon');
  assert.equal(districtAt(250, 40), 'heights');
  assert.equal(districtAt(250, 220), 'downtown');
  assert.equal(districtAt(250, 460), 'neon');
  assert.equal(districtAt(500, 220), 'port');

  assert.equal(streetAt(0, 150), 'Ocean Drive');
  assert.equal(streetAt(150, 72), 'Palm Drive');

  const path = route(0, 0, 216, 216);
  assert.ok(path.length >= 6, 'BFS route should span multiple intersections');
  assert.deepEqual(path[0], [0, 0]);
  assert.deepEqual(path[path.length - 1], [216, 216]);

  // Every stunt ramp must sample cleanly and sit clear of cross-street intersections
  for (const ramp of STUNT_RAMPS) {
    const midSample = sampleStuntRamp(ramp.x, ramp.z);
    assert.ok(midSample, `Stunt ramp ${ramp.id} should sample valid ramp data`);
    assert.ok(
      midSample.height > ramp.height * 0.4 && midSample.height < ramp.height * 0.6,
      `Center of ${ramp.id} should be approximately half height`,
    );
    const fx = Math.abs(ramp.x - Math.round(ramp.x / BLOCK) * BLOCK);
    const fz = Math.abs(ramp.z - Math.round(ramp.z / BLOCK) * BLOCK);
    assert.ok(
      !(fx < 6 && fz < 6),
      `Stunt ramp ${ramp.id} must not sit inside a 4-way intersection`,
    );
  }
  assert.equal(sampleStuntRamp(9999, 9999), null);
});

test('isValidTreeSpot rejects roads, intersections, crosswalks, pier entrance, ocean surf, and stunt ramps', () => {
  // Intersection center & crosswalk corners must be rejected
  assert.equal(isValidTreeSpot(72, 72), false, 'Intersection center must reject trees');
  assert.equal(isValidTreeSpot(62, 72), false, 'Cross-street asphalt must reject trees');
  assert.equal(isValidTreeSpot(62, 62), false, 'Crosswalk corner must reject trees');

  // Pier entrance & ocean must be rejected
  assert.equal(isValidTreeSpot(-10, PIER_Z), false, 'Pier entrance must reject trees');
  assert.equal(isValidTreeSpot(-70, 200), false, 'Ocean surf must reject trees');

  // Stunt ramp corridor must be rejected
  assert.equal(isValidTreeSpot(-34, 185), false, 'Beach stunt ramp must reject trees');

  // Valid mid-block boulevard sidewalk & promenade planter spots must be accepted
  assert.equal(isValidTreeSpot(-10.6, 150), true, 'Open promenade planter should allow trees');
  assert.equal(isValidTreeSpot(62, 100), true, 'Mid-block sidewalk verge should allow trees');
});

test('Collision resolves AABB/circle push-outs and blocks occluded sightlines', () => {
  const col = new Collision();
  col.addBox(10, 10, 20, 20, 12);
  col.addCircle(40, 40, 3, 6);

  const pushedBox = col.resolve(10.2, 15, 1);
  assert.equal(pushedBox.hit, true);
  assert.ok(pushedBox.x <= 9.01, 'Circle should be pushed outside west face of box');

  const pushedCircle = col.resolve(41, 40, 2.5);
  assert.equal(pushedCircle.hit, true);
  assert.ok(Math.hypot(pushedCircle.x - 40, pushedCircle.z - 40) >= 5.49);

  assert.equal(col.clearLine(0, 15, 30, 15), false, 'Building box should block sightline');
  assert.equal(col.clearLine(0, 0, 5, 5), true, 'Open corridor should have clear sightline');
});

test('StuntSystem handles nitrous boost, drifting payout, ramp jumps, near-misses, and hard crashes', () => {
  const st = createStuntState();
  const boostRes = stepStuntState(st, {
    dt: 0.05,
    speed: 25,
    lateralSpeed: 0,
    airborne: false,
    height: 0,
    wantNitro: true,
    nitroTier: 2,
    handbrake: false,
    crashedHard: false,
  });
  assert.equal(st.boosting, true);
  assert.ok(boostRes.nitroMultiplier > 1.4, 'Tier 2 nitrous should boost top speed > 1.4x');
  assert.ok(st.nitro < 65, 'Nitrous should drain while boosting');

  // Sustained drift builds combo points and recharges nitrous
  const nitroBeforeDrift = st.nitro;
  for (let i = 0; i < 30; i++) {
    stepStuntState(st, {
      dt: 0.05,
      speed: 22,
      lateralSpeed: 6.2,
      airborne: false,
      height: 0,
      wantNitro: false,
      nitroTier: 1,
      handbrake: true,
      crashedHard: false,
    });
  }
  assert.ok(st.comboPoints > 150, 'Drifting should build combo points');
  assert.ok(st.nitro > nitroBeforeDrift, 'Drifting should recharge nitrous');

  // Hard crash wipes unbanked combo
  stepStuntState(st, {
    dt: 0.05,
    speed: 10,
    lateralSpeed: 0,
    airborne: false,
    height: 0,
    wantNitro: false,
    nitroTier: 1,
    handbrake: false,
    crashedHard: true,
  });
  assert.equal(st.comboPoints, 0);

  // Stunt jump airtime + landing produces jump event
  for (let i = 0; i < 14; i++) {
    stepStuntState(st, {
      dt: 0.05,
      speed: 32,
      lateralSpeed: 0,
      airborne: true,
      height: 3.4,
      wantNitro: false,
      nitroTier: 1,
      handbrake: false,
      crashedHard: false,
    });
  }
  const landRes = stepStuntState(st, {
    dt: 0.05,
    speed: 30,
    lateralSpeed: 0,
    airborne: false,
    height: 0,
    wantNitro: false,
    nitroTier: 1,
    handbrake: false,
    crashedHard: false,
  });
  assert.ok(
    landRes.events.some((e) => e.kind === 'jump' && e.cash > 0),
    'Landing a long high-speed jump should award stunt jump cash',
  );
  assert.ok(st.bestJumpMeters >= 20);

  // Near miss respects cooldown
  const nm1 = registerNearMiss(st, 28, 1);
  const nm2 = registerNearMiss(st, 28, 1);
  assert.ok(nm1 && nm1.cash > 0);
  assert.equal(nm2, null, 'Immediate second near miss should be gated by cooldown');
});

test('WeatherRules cycles all 4 atmospheres with storm wet-road grip modulation', () => {
  let w = WEATHER_ORDER[0];
  for (let i = 1; i <= WEATHER_ORDER.length; i++) {
    w = nextWeatherMode(w);
    assert.equal(w, WEATHER_ORDER[i % WEATHER_ORDER.length]);
  }
  assert.ok(
    WEATHER_SPECS.storm.roadRoughness < WEATHER_SPECS.golden.roadRoughness,
    'Storm roads should be glossier (lower roughness) than dry golden hour roads',
  );
  assert.ok(
    WEATHER_SPECS.storm.gripScale < WEATHER_SPECS.golden.gripScale,
    'Storm roads should slightly lower tire grip',
  );
});

test('WantedSystem and Reputation pure progression thresholds behave deterministically', () => {
  assert.equal(computeWantedLevel(0), 0);
  assert.equal(computeWantedLevel(15), 1);
  assert.equal(computeWantedLevel(75), 3);
  assert.equal(computeWantedLevel(210), 5);
  assert.ok(evadeDuration(4) > evadeDuration(1));

  assert.equal(reputationLevel(0), 1);
  assert.equal(reputationLevel(1850), 6);
  assert.equal(reputationTitle(6), 'Vice Coast Legend');
  assert.ok(reputationBonus(6) > reputationBonus(1));
});
