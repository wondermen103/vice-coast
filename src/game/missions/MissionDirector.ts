// MissionDirector: Orchestrates 8 story missions, glowing 3D objective beacons,
// Boardwalk Rush side race, 10 collectible Golden Conches, and minimap blip/GPS export.
import * as THREE from 'three';
import { CAST, PLACES, SIDE, STORY, type MissionDef, type StoryStep } from './StoryMissions.ts';
import { Vehicle } from '../vehicles/Vehicle.ts';
import { Ped } from '../people/Pedestrians.ts';
import { formatMoney } from '../core/MathUtil.ts';
import { GANG_LOOK } from '../people/PersonModel.ts';

function makeBeacon(color: string, radius = 3.2): THREE.Group {
  const g = new THREE.Group();
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(radius * 0.72, radius, 28),
    new THREE.MeshBasicMaterial({
      color,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
    }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.08;
  g.add(ring);

  const col = new THREE.Mesh(
    new THREE.CylinderGeometry(radius * 0.45, radius * 0.72, 22, 16, 1, true),
    new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.22,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );
  col.position.y = 11;
  g.add(col);
  g.visible = false;
  return g;
}

export interface ActiveMissionSnapshot {
  title: string;
  cue: string;
  stepIndex: number;
  totalSteps: number;
  timer: number | null;
  kind: 'story' | 'race';
}

export interface MinimapBlip {
  x: number;
  z: number;
  color: string;
  kind: 'story' | 'goal' | 'shop' | 'garage' | 'safe' | 'race' | 'conch' | 'waypoint' | 'cashvan';
  label?: string;
}

export class MissionDirector {
  public done: string[] = [];
  public conches = new Set<number>();
  public active: MissionDef | null = null;
  public stepIdx = 0;
  public stepTimer: number | null = null;
  public raceGate = 0;
  public sideRace: { gate: number; timer: number; best: number } | null = null;

  private targetVehicle: Vehicle | null = null;
  private enemies: Ped[] = [];
  private giverBeacon: THREE.Group;
  private goalBeacon: THREE.Group;
  private raceBeacon: THREE.Group;
  private conchMeshes: Array<{ idx: number; mesh: THREE.Mesh }> = [];
  private pulse = 0;

  constructor(private G: any) {
    this.giverBeacon = makeBeacon('#ff7c5c', 3.4);
    this.goalBeacon = makeBeacon('#00f0d8', 4.2);
    this.raceBeacon = makeBeacon('#ff2e93', 4.4);
    G.scene.add(this.giverBeacon, this.goalBeacon, this.raceBeacon);
    this.spawnConches();
  }

  private spawnConches(): void {
    const geo = new THREE.OctahedronGeometry(0.68, 0);
    const mat = new THREE.MeshStandardMaterial({
      color: 0xffd25a,
      emissive: 0xd98a1c,
      emissiveIntensity: 0.75,
      roughness: 0.22,
      metalness: 0.85,
    });
    SIDE.conches.forEach(([x, z], idx) => {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, 1.15, z);
      this.G.scene.add(m);
      this.conchMeshes.push({ idx, mesh: m });
    });
  }

  nextStory(): MissionDef | null {
    return STORY.find((m) => !this.done.includes(m.id)) ?? null;
  }

  startMission(m: MissionDef): void {
    this.clearStepEntities();
    this.active = m;
    this.stepIdx = 0;
    this.sideRace = null;
    this.G.ui.missionBanner(`MISSION ${m.num} · ${m.title.toUpperCase()}`, m.sub, 'info');
    this.G.audio?.fanfare();
    for (const [spk, line] of m.intro) {
      const c = CAST[spk];
      this.G.ui.say(c?.name ?? spk, line, c?.color ?? '#f5b841');
    }
    this.beginStep();
  }

  startSideRace(): void {
    if (this.active || this.sideRace) return;
    if (!this.G.player.vehicle) {
      this.G.ui.toast('Get in a vehicle to start Boardwalk Rush', 'bad');
      return;
    }
    this.sideRace = { gate: 0, timer: 68, best: 0 };
    this.G.ui.missionBanner('BOARDWALK RUSH', 'Hit all 6 Ocean Drive gates before time expires · $1,800 prize', 'info');
    this.G.audio?.fanfare();
  }

  private clearStepEntities(): void {
    for (const e of this.enemies) {
      e.dispose();
      const idx = this.G.peds.indexOf(e);
      if (idx >= 0) this.G.peds.splice(idx, 1);
    }
    this.enemies.length = 0;
    this.targetVehicle = null;
    this.stepTimer = null;
    this.raceGate = 0;
  }

  private stepTarget(s: StoryStep): { x: number; z: number } | null {
    if (s.kind === 'race' && s.checkpoints) {
      const pt = s.checkpoints[this.raceGate];
      return pt ? { x: pt[0], z: pt[1] } : null;
    }
    if (s.kind === 'steal' && this.targetVehicle) {
      return { x: this.targetVehicle.x, z: this.targetVehicle.z };
    }
    if (s.place && PLACES[s.place]) {
      return { x: PLACES[s.place].x, z: PLACES[s.place].z };
    }
    if (s.x !== undefined && s.z !== undefined) {
      return { x: s.x, z: s.z };
    }
    return null;
  }

  private beginStep(): void {
    this.clearStepEntities();
    if (!this.active) return;
    const s = this.active.steps[this.stepIdx];
    if (!s) {
      this.completeMission();
      return;
    }
    this.stepTimer = s.timeLimit ?? null;
    this.raceGate = 0;

    if (s.kind === 'steal' && s.x !== undefined && s.z !== undefined) {
      const v = new Vehicle(
        this.G,
        s.carModel || 'aureo',
        s.carPaint || '#f5b841',
        s.x,
        s.z,
        0,
      );
      v.role = 'mission';
      this.G.vehicles.push(v);
      this.targetVehicle = v;
    }

    if (s.kind === 'combat' && s.x !== undefined && s.z !== undefined) {
      const count = s.enemies ?? 4;
      for (let i = 0; i < count; i++) {
        const ang = (i / count) * Math.PI * 2;
        const px = s.x + Math.cos(ang) * 6.5;
        const pz = s.z + Math.sin(ang) * 6.5;
        const e = new Ped(this.G, GANG_LOOK, px, pz, 'gang');
        e.health = 75;
        this.G.peds.push(e);
        this.enemies.push(e);
      }
      if (s.wanted) this.G.wanted.raise(s.wanted);
    }
  }

  private advanceStep(): void {
    if (!this.active) return;
    const s = this.active.steps[this.stepIdx];
    if (s?.line) {
      const c = CAST[s.line[0]];
      this.G.ui.say(c?.name ?? s.line[0], s.line[1], c?.color ?? '#f5b841');
    }
    this.stepIdx++;
    if (this.stepIdx >= this.active.steps.length) {
      this.completeMission();
    } else {
      this.G.audio?.pickup();
      this.beginStep();
    }
  }

  private completeMission(): void {
    const m = this.active;
    if (!m) return;
    this.clearStepEntities();
    this.active = null;
    if (!this.done.includes(m.id)) this.done.push(m.id);
    const payout = Math.round(m.pay * this.G.rep.bonus);
    this.G.economy.earn(payout);
    this.G.rep.earn(m.rep);
    if (m.unlocks === 'sullyFull') {
      this.G.economy.sullyFullUnlocked = true;
    }
    this.G.ui.missionBanner(
      'MISSION PASSED',
      `${m.title} · +${formatMoney(payout)} · RESPECT +${m.rep}`,
      'pass',
    );
    const c = CAST[m.outro[0]];
    this.G.ui.say(c?.name ?? m.outro[0], m.outro[1], c?.color ?? '#2fd4c8');
    this.G.audio?.fanfare();
    this.G.save?.save();
  }

  failMission(reason: string): void {
    if (this.active) {
      this.clearStepEntities();
      const title = this.active.title;
      this.active = null;
      this.G.ui.missionBanner('MISSION FAILED', `${title} · ${reason}`, 'fail');
    }
    if (this.sideRace) {
      this.sideRace = null;
      this.G.ui.missionBanner('RACE FAILED', reason, 'fail');
    }
  }

  snapshot(): ActiveMissionSnapshot | null {
    if (this.active) {
      const s = this.active.steps[this.stepIdx];
      let cue = s?.cue ?? '';
      if (s?.kind === 'combat') {
        const alive = this.enemies.filter((e) => !e.dead).length;
        cue = `${s.cue} (${alive} remaining)`;
      } else if (s?.kind === 'race' && s.checkpoints) {
        cue = `Checkpoint ${this.raceGate + 1}/${s.checkpoints.length}`;
      }
      return {
        title: `M${this.active.num} · ${this.active.title}`,
        cue,
        stepIndex: this.stepIdx,
        totalSteps: this.active.steps.length,
        timer: this.stepTimer,
        kind: 'story',
      };
    }
    if (this.sideRace) {
      return {
        title: 'Boardwalk Rush',
        cue: `Gate ${this.sideRace.gate + 1}/${SIDE.raceGates.length}`,
        stepIndex: this.sideRace.gate,
        totalSteps: SIDE.raceGates.length,
        timer: this.sideRace.timer,
        kind: 'race',
      };
    }
    const next = this.nextStory();
    if (next) {
      const place = PLACES[next.giverPlace];
      return {
        title: `Next · ${next.title}`,
        cue: `Meet ${CAST[next.giver].name} at ${place.label}`,
        stepIndex: 0,
        totalSteps: 1,
        timer: null,
        kind: 'story',
      };
    }
    return {
      title: 'Vice Coast Legend',
      cue: `Free Roam · ${this.conches.size}/${SIDE.conches.length} Golden Shells`,
      stepIndex: 1,
      totalSteps: 1,
      timer: null,
      kind: 'story',
    };
  }

  gpsTarget(): { x: number; z: number; color: string } | null {
    if (this.G.waypoint) {
      return { x: this.G.waypoint.x, z: this.G.waypoint.z, color: '#2fd4c8' };
    }
    if (this.active) {
      const s = this.active.steps[this.stepIdx];
      const pt = s ? this.stepTarget(s) : null;
      if (pt) return { ...pt, color: '#2fd4c8' };
    }
    if (this.sideRace) {
      const pt = SIDE.raceGates[this.sideRace.gate];
      if (pt) return { x: pt[0], z: pt[1], color: '#ff52c8' };
    }
    const next = this.nextStory();
    if (next) {
      const p = PLACES[next.giverPlace];
      return { x: p.x, z: p.z, color: '#f5b841' };
    }
    return null;
  }

  minimapBlips(): MinimapBlip[] {
    const blips: MinimapBlip[] = [
      { x: PLACES.safehouse.x, z: PLACES.safehouse.z, color: '#2fd4c8', kind: 'safe', label: 'Safehouse' },
      { x: PLACES.sully.x, z: PLACES.sully.z, color: '#ff9642', kind: 'garage', label: "Sully's" },
      { x: PLACES.guns.x, z: PLACES.guns.z, color: '#ff5263', kind: 'shop', label: 'Tidewater' },
      { x: SIDE.raceStart.x, z: SIDE.raceStart.z, color: '#ff52c8', kind: 'race', label: 'Race' },
    ];
    if (this.active) {
      const s = this.active.steps[this.stepIdx];
      const pt = s ? this.stepTarget(s) : null;
      if (pt) blips.push({ x: pt.x, z: pt.z, color: '#2fd4c8', kind: 'goal' });
    } else if (this.sideRace) {
      const pt = SIDE.raceGates[this.sideRace.gate];
      if (pt) blips.push({ x: pt[0], z: pt[1], color: '#ff52c8', kind: 'goal' });
    } else {
      const next = this.nextStory();
      if (next) {
        const p = PLACES[next.giverPlace];
        blips.push({ x: p.x, z: p.z, color: '#f5b841', kind: 'story', label: next.title });
      }
    }
    if (this.G.waypoint) {
      blips.push({ x: this.G.waypoint.x, z: this.G.waypoint.z, color: '#73e5a1', kind: 'waypoint' });
    }
    for (const v of this.G.vehicles) {
      if (v.role === 'cashvan' && !v.dead) {
        blips.push({ x: v.x, z: v.z, color: '#f5b841', kind: 'cashvan' });
      }
    }
    return blips;
  }

  update(dt: number): void {
    const G = this.G;
    const P = G.player;
    this.pulse += dt * 3;

    // Animate & collect 10 Golden Conches
    for (const c of this.conchMeshes) {
      if (this.conches.has(c.idx)) {
        c.mesh.visible = false;
        continue;
      }
      c.mesh.visible = true;
      c.mesh.rotation.y += dt * 2.2;
      c.mesh.position.y = 1.15 + Math.sin(this.pulse + c.idx) * 0.22;
      if (Math.hypot(c.mesh.position.x - P.x, c.mesh.position.z - P.z) < 3.4) {
        this.conches.add(c.idx);
        c.mesh.visible = false;
        G.economy.earn(750);
        G.rep.earn(45);
        G.audio?.pickup();
        G.ui.toast(
          `GOLDEN SHELL ${this.conches.size}/${SIDE.conches.length} · +$750`,
          'good',
        );
      }
    }

    // Clear custom waypoint when reached
    if (G.waypoint && Math.hypot(G.waypoint.x - P.x, G.waypoint.z - P.z) < 12) {
      G.waypoint = null;
      G.ui.toast('Waypoint Reached', 'good');
    }

    // Side Race Boardwalk Rush
    if (this.sideRace) {
      this.giverBeacon.visible = false;
      this.goalBeacon.visible = false;
      this.sideRace.timer -= dt;
      if (this.sideRace.timer <= 0) {
        this.failMission('Time expired');
        return;
      }
      const pt = SIDE.raceGates[this.sideRace.gate];
      this.raceBeacon.visible = true;
      this.raceBeacon.position.set(pt[0], 0, pt[1]);
      this.raceBeacon.scale.setScalar(1 + Math.sin(this.pulse * 2) * 0.06);
      if (Math.hypot(P.x - pt[0], P.z - pt[1]) < 11) {
        this.sideRace.gate++;
        G.audio?.pickup();
        if (this.sideRace.gate >= SIDE.raceGates.length) {
          this.sideRace = null;
          this.raceBeacon.visible = false;
          const prize = Math.round(1800 * G.rep.bonus);
          G.economy.earn(prize);
          G.rep.earn(90);
          G.ui.missionBanner('BOARDWALK RUSH WON', `+${formatMoney(prize)} · RESPECT +90`, 'pass');
          G.audio?.fanfare();
        }
      }
      return;
    }

    // Active story mission
    if (this.active) {
      this.giverBeacon.visible = false;
      this.raceBeacon.visible = false;
      const s = this.active.steps[this.stepIdx];
      if (!s) return;

      if (this.stepTimer !== null) {
        this.stepTimer -= dt;
        if (this.stepTimer <= 0) {
          this.failMission('Out of time');
          return;
        }
      }

      const pt = this.stepTarget(s);
      if (pt) {
        this.goalBeacon.visible = true;
        this.goalBeacon.position.set(pt.x, 0, pt.z);
        this.goalBeacon.scale.setScalar(1 + Math.sin(this.pulse * 2) * 0.05);
      } else {
        this.goalBeacon.visible = false;
      }

      if (s.kind === 'go' && pt) {
        if (Math.hypot(P.x - pt.x, P.z - pt.z) < (s.radius ?? 16)) {
          this.advanceStep();
        }
      } else if (s.kind === 'steal') {
        if (this.targetVehicle?.dead) {
          this.failMission('Target vehicle destroyed');
          return;
        }
        if (P.vehicle && P.vehicle === this.targetVehicle) {
          if (s.wanted) G.wanted.raise(s.wanted);
          this.advanceStep();
        }
      } else if (s.kind === 'combat') {
        const alive = this.enemies.filter((e) => !e.dead).length;
        if (alive === 0) this.advanceStep();
      } else if (s.kind === 'deliver' && pt) {
        if (Math.hypot(P.x - pt.x, P.z - pt.z) < (s.radius ?? 14)) {
          this.advanceStep();
        }
      } else if (s.kind === 'evade') {
        if (G.wanted.level === 0) this.advanceStep();
      } else if (s.kind === 'race' && s.checkpoints && pt) {
        if (Math.hypot(P.x - pt.x, P.z - pt.z) < 12) {
          this.raceGate++;
          G.audio?.pickup();
          if (this.raceGate >= s.checkpoints.length) {
            this.advanceStep();
          }
        }
      }
      return;
    }

    // Idle free-roam: show next story mission beacon & Boardwalk Rush beacon
    this.goalBeacon.visible = false;
    const next = this.nextStory();
    if (next) {
      const p = PLACES[next.giverPlace];
      this.giverBeacon.visible = true;
      this.giverBeacon.position.set(p.x, 0, p.z);
      if (Math.hypot(P.x - p.x, P.z - p.z) < 8) {
        G.ui.hint(`Press E · Start Mission ${next.num}: ${next.title}`);
        if (G.input.pressed('KeyE')) {
          this.startMission(next);
          return;
        }
      }
    } else {
      this.giverBeacon.visible = false;
    }

    // Boardwalk Rush start trigger
    this.raceBeacon.visible = true;
    this.raceBeacon.position.set(SIDE.raceStart.x, 0, SIDE.raceStart.z);
    if (Math.hypot(P.x - SIDE.raceStart.x, P.z - SIDE.raceStart.z) < 9) {
      G.ui.hint('Press E · Start Boardwalk Rush ($1,800)');
      if (G.input.pressed('KeyE')) {
        this.startSideRace();
      }
    }
  }
}
