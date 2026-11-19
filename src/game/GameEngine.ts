// GameEngine: Three.js lifecycle, fixed-dt simulation loop, hitstop, flyover title camera,
// software-WebGL fenceSync frame pacer, fast-travel/call-car, and throttled React UI bridge.
import * as THREE from 'three';
import { Input } from './core/Input.ts';
import { Emitter, clamp } from './core/MathUtil.ts';
import {
  WEATHER_SPECS,
  type WeatherMode,
} from './core/WeatherRules.ts';
import { Collision } from './world/Collision.ts';
import { SkyAndSun } from './world/SkyAndSun.ts';
import { CityBuilder } from './world/CityBuilder.ts';
import { Props } from './world/Props.ts';
import { DISTRICTS, districtAt, streetAt } from './world/CityLayout.ts';
import { PostFX, createFramePacer, detectSoftwareGl } from './render/PostFX.ts';
import { Particles } from './fx/Particles.ts';
import { AudioEngine } from './audio/AudioEngine.ts';
import { RadioSynth } from './audio/RadioSynth.ts';
import { TrafficSystem } from './traffic/TrafficAI.ts';
import { Ped, PedSystem } from './people/Pedestrians.ts';
import { buildPerson } from './people/PersonModel.ts';
import {
  PROTAGONIST_INFO,
  PlayerController,
  respawnAt,
  type ProtagonistId,
} from './player/PlayerController.ts';
import { Carjacking } from './vehicles/Carjacking.ts';
import { ChaseCamera, type CameraMode } from './camera/ChaseCamera.ts';
import { Combat, WEAPONS } from './combat/Weapons.ts';
import { WantedSystem } from './police/WantedSystem.ts';
import { PoliceDispatch, type PoliceRosterEntry } from './police/PoliceDispatch.ts';
import { Reputation } from './progression/Reputation.ts';
import {
  MissionDirector,
  type ActiveMissionSnapshot,
} from './missions/MissionDirector.ts';
import {
  CAST,
  PLACES,
  PROLOGUE_LINES,
  SIDE,
  STORY,
  VICEGRAM_POSTS,
} from './missions/StoryMissions.ts';
import { Economy, type ShopModalState } from './economy/ShopsAndGarage.ts';
import { SaveGame } from './save/SaveGame.ts';
import { drawGtaRadar, type MinimapState } from './ui/MinimapRenderer.ts';

export type GameStateMode = 'title' | 'playing' | 'paused' | 'gameover';

export interface ToastItem {
  id: number;
  text: string;
  kind: 'info' | 'good' | 'bad' | 'rep' | 'alert';
}

export interface BannerItem {
  id: number;
  title: string;
  sub: string;
  kind: 'info' | 'pass' | 'fail';
}

export interface DialogueItem {
  id: number;
  speaker: string;
  text: string;
  color: string;
}

export interface WeaponWheelItem {
  index: number;
  id: string;
  name: string;
  role: string;
  owned: boolean;
  ammo: number | null;
  dmg: number;
  rate: number;
}

export interface HudSnapshot {
  mode: GameStateMode;
  hasSave: boolean;
  money: number;
  clock: string;
  weather: WeatherMode;
  weatherLabel: string;
  districtName: string;
  districtColor: string;
  streetName: string;
  protagonist: ProtagonistId;
  protagonistName: string;
  protagonistFirstName: string;
  protagonistPerk: string;
  protagonistAccent: string;
  health: number;
  armor: number;
  focus: number;
  focusActive: boolean;
  stamina: number;
  repLevel: number;
  repTitle: string;
  repProgress: number;
  wantedLevel: number;
  wantedSeen: boolean;
  wantedEvadePct: number;
  policeRoster: PoliceRosterEntry[];
  weaponName: string;
  weaponRole: string;
  weaponId: string;
  weaponAmmo: number | null;
  weaponIndex: number;
  ownedWeapons: string[];
  weaponsList: WeaponWheelItem[];
  weaponWheelOpen: boolean;
  phoneOpen: boolean;
  storyChapter: number;
  inVehicle: boolean;
  vehicleName: string;
  vehicleSpeedKmh: number;
  vehicleHealthPct: number;
  vehicleGear: string;
  vehicleNitro: number;
  vehicleBoosting: boolean;
  vehicleNitroTier: number;
  vehicleFinish: string;
  driftScore: number;
  comboMult: number;
  airtime: number;
  cameraMode: CameraMode;
  muted: boolean;
  radioStation: string;
  radioGenre: string;
  radioSong: string;
  radioAccent: string;
  mission: ActiveMissionSnapshot | null;
  missionsDone: number;
  missionsTotal: number;
  conchesFound: number;
  conchesTotal: number;
  totalStuntCash: number;
  longestJump: number;
  longestDrift: number;
  hint: string;
  downedCause: 'wasted' | 'busted' | null;
  minimap: MinimapState;
}

export interface EngineCallbacks {
  onHud: (snap: HudSnapshot) => void;
  onToast: (t: ToastItem) => void;
  onBanner: (b: BannerItem) => void;
  onDialogue: (d: DialogueItem | null) => void;
  onMoneyPop: (amount: number) => void;
  onDamageFlash: () => void;
  onHitmarker: () => void;
  onShopChange: (shop: ShopModalState | null) => void;
}

export class GameEngine {
  public G: any;
  private renderer: THREE.WebGLRenderer;
  private resizeObs: ResizeObserver;
  private pacer: ReturnType<typeof createFramePacer>;
  private radarCanvas: HTMLCanvasElement | null = null;
  private disposed = false;
  private lastTime = 0;
  private uiAcc = 0;
  private flyT = 0;
  private toastId = 1;
  private bannerId = 1;
  private dialogueId = 1;
  private dialogueQueue: DialogueItem[] = [];
  private dialogueTimer = 0;
  private frameHint = '';
  private downedCause: 'wasted' | 'busted' | null = null;
  private weaponWheelOpen = false;
  private phoneOpen = false;
  private partnerPed: Ped | null = null;
  private onKeyDown: (e: KeyboardEvent) => void;
  private onContextLost: (e: Event) => void;
  private onContextRestored: () => void;

  constructor(
    private mountEl: HTMLElement,
    private callbacks: EngineCallbacks,
  ) {
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
    });
    const isSoftwareGl = detectSoftwareGl(renderer);
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.setSize(mountEl.clientWidth || window.innerWidth, mountEl.clientHeight || window.innerHeight);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    mountEl.innerHTML = '';
    mountEl.appendChild(renderer.domElement);
    this.renderer = renderer;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      62,
      (mountEl.clientWidth || window.innerWidth) / Math.max(1, mountEl.clientHeight || window.innerHeight),
      0.25,
      1600,
    );

    const G: any = {
      renderer,
      scene,
      camera,
      isSoftwareGl,
      mode: 'title' as 'title' | 'play' | 'pause' | 'down',
      events: new Emitter(),
      hitstop: 0,
      godMode: false,
      waypoint: null as { x: number; z: number } | null,
      vehicles: [],
      peds: [],
    };
    this.G = G;

    G.post = new PostFX(renderer, isSoftwareGl);
    G.post.setSize(
      Math.max(2, Math.floor((mountEl.clientWidth || window.innerWidth) * renderer.getPixelRatio())),
      Math.max(2, Math.floor((mountEl.clientHeight || window.innerHeight) * renderer.getPixelRatio())),
    );
    G.input = new Input(renderer.domElement);
    G.collision = new Collision();
    G.audio = new AudioEngine();
    G.radio = new RadioSynth(G.audio);
    G.sky = new SkyAndSun(G);
    G.city = new CityBuilder(G).build();
    G.props = new Props(G).build(G.city);
    G.fx = new Particles(G);
    G.rep = new Reputation(G);
    G.economy = new Economy(G);
    G.combat = new Combat(G);
    G.wanted = new WantedSystem(G);
    G.police = new PoliceDispatch(G);
    G.traffic = new TrafficSystem(G);
    G.pedSystem = new PedSystem(G);
    G.player = new PlayerController(G);
    G.carjack = new Carjacking(G);
    G.cam = new ChaseCamera(G);
    G.missions = new MissionDirector(G);
    G.save = new SaveGame(G);

    // Attach helper methods to G
    G.callPersonalCar = (tx?: number, tz?: number) => this.callPersonalCar(tx, tz);
    G.onProtagonistSwitched = () => this.syncPartnerWithProtagonist();

    // Wire UI bridge
    G.ui = {
      toast: (text: string, kind: ToastItem['kind'] = 'info') => {
        this.callbacks.onToast({ id: this.toastId++, text, kind });
      },
      missionBanner: (title: string, sub: string, kind: BannerItem['kind'] = 'info') => {
        this.callbacks.onBanner({ id: this.bannerId++, title, sub, kind });
      },
      say: (speaker: string, text: string, color = '#f5b841') => {
        this.dialogueQueue.push({ id: this.dialogueId++, speaker, text, color });
        if (this.dialogueTimer <= 0) this.advanceDialogue();
      },
      hint: (text: string) => {
        this.frameHint = text;
      },
      moneyPop: (amount: number) => {
        this.callbacks.onMoneyPop(amount);
      },
      flashDamage: () => {
        this.callbacks.onDamageFlash();
      },
      triggerHitmarker: () => {
        this.callbacks.onHitmarker();
      },
      wantedUp: (lv: number) => {
        this.callbacks.onToast({
          id: this.toastId++,
          text: `WANTED LEVEL · ${'★'.repeat(lv)}`,
          kind: 'bad',
        });
      },
      openShop: (shop: ShopModalState) => {
        this.callbacks.onShopChange(shop);
      },
      closeShop: () => {
        this.callbacks.onShopChange(null);
      },
    };

    // World events
    G.events.on('playerDown', ({ cause }: { cause: 'wasted' | 'busted' }) => {
      this.handlePlayerDown(cause);
    });
    G.events.on('pedKilled', ({ ped, byPlayer }: { ped: any; byPlayer: boolean }) => {
      if (!byPlayer) return;
      if (ped.role === 'cop') G.wanted.crime('killCop', ped.x, ped.z);
      else if (ped.role === 'civ') G.wanted.crime('killPed', ped.x, ped.z);
      else if (ped.role === 'gang') G.rep.earn(15);
    });

    // Spawn initial fleet, Nico & starter Veloz Comet RS right outside El Mirador Safehouse
    G.traffic.init();
    this.placeStarterScene();

    // Context loss & resize handling
    this.onContextLost = (e: Event) => {
      e.preventDefault();
    };
    this.onContextRestored = () => {
      G.sky.setWeather(G.sky.weather, false);
    };
    renderer.domElement.addEventListener('webglcontextlost', this.onContextLost);
    renderer.domElement.addEventListener('webglcontextrestored', this.onContextRestored);

    this.resizeObs = new ResizeObserver(() => this.handleResize());
    this.resizeObs.observe(mountEl);

    // Keyboard shortcuts for Title, Pause, Weapon Wheel (Tab), Smartphone (T), and Shop hotkeys
    this.onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Tab' && G.mode === 'play' && !G.economy.activeShop) {
        e.preventDefault();
        this.toggleWeaponWheel();
        return;
      }
      if (e.code === 'KeyT' && G.mode === 'play' && !G.economy.activeShop) {
        e.preventDefault();
        this.togglePhone();
        return;
      }
      if (e.code === 'KeyG' && G.mode === 'play' && !G.economy.activeShop) {
        e.preventDefault();
        this.switchProtagonist();
        return;
      }
      if (e.code === 'Escape' || e.code === 'KeyP' || e.code === 'KeyM') {
        if (G.economy.activeShop) {
          e.preventDefault();
          G.economy.closeShop();
          return;
        }
        if (e.code === 'Escape' && (this.weaponWheelOpen || this.phoneOpen)) {
          e.preventDefault();
          this.weaponWheelOpen = false;
          this.phoneOpen = false;
          this.emitHud();
          return;
        }
        if (G.mode === 'play') {
          e.preventDefault();
          this.weaponWheelOpen = false;
          this.phoneOpen = false;
          this.setPaused(true);
          return;
        }
        if (G.mode === 'pause') {
          e.preventDefault();
          this.setPaused(false);
          return;
        }
      }
      if (G.economy.activeShop && /^Digit[1-7]$/.test(e.code)) {
        const idx = Number(e.code.slice(5)) - 1;
        const modal = G.economy.buildShopModal(G.economy.activeShop);
        const item = modal.items[idx];
        if (item && !item.disabled) {
          G.economy.selectShopItem(item.id);
        }
      }
      if (G.mode === 'title' && (e.code === 'Enter' || e.code === 'Space')) {
        e.preventDefault();
        this.startNewGame();
      }
    };
    window.addEventListener('keydown', this.onKeyDown);

    // Support ?autostart=1 for automated checks & instant jump-in
    const params = new URLSearchParams(window.location.search);
    if (params.get('autostart') === '1') {
      this.startNewGame();
    } else {
      this.syncBodyState('title');
      this.emitHud();
    }

    this.pacer = createFramePacer(renderer, isSoftwareGl);
    this.lastTime = performance.now();
    // Render initial frame immediately so first paint is never blank
    this.step(0.016, 0);
    this.pacer.scheduleNext(this.loop);
  }

  private placeStarterScene(): void {
    const G = this.G;
    const sh = PLACES.safehouse;
    G.player.place(sh.x - 14.0, sh.z + 5.2, Math.PI * 0.42);
    G.player.ped.sync(0);
    // Partner protagonist (Lucia Reyes) standing right beside Jason outside Bayview Safehouse
    this.ensurePartnerAt(sh.x - 12.6, sh.z + 3.4, Math.PI * 0.62);
    // Starter Viper Comet RS parked right by Jason & Lucia outside Bayview Safehouse
    const starter = G.traffic.add('comet', '#e0244a', sh.x - 17.6, sh.z + 4.0, 0, 'parked');
    starter.setFinish('gloss');
    starter.nitroTier = 1;
    G.cam.yaw = -0.34;
    G.cam.pitch = 0.16;
    G.cam.snap = true;
  }

  private ensurePartnerAt(x: number, z: number, heading: number): void {
    const G = this.G;
    const partnerId: ProtagonistId = G.player.protagonist === 'jason' ? 'lucia' : 'jason';
    const look = { ...PROTAGONIST_INFO[partnerId].look };
    if (!this.partnerPed) {
      const p = new Ped(G, look, x, z, 'npc');
      p.heading = heading;
      p.follow = true;
      p.mission = true;
      G.peds.push(p);
      this.partnerPed = p;
    } else {
      G.scene.remove(this.partnerPed.rig.root);
      this.partnerPed.look = look;
      this.partnerPed.rig = buildPerson(look, !!G.isSoftwareGl);
      G.scene.add(this.partnerPed.rig.root);
      this.partnerPed.x = x;
      this.partnerPed.z = z;
      this.partnerPed.heading = heading;
      this.partnerPed.dead = false;
      this.partnerPed.health = 100;
      this.partnerPed.sync(0);
    }
  }

  private syncPartnerWithProtagonist(): void {
    const G = this.G;
    if (!this.partnerPed) return;
    const partnerId: ProtagonistId = G.player.protagonist === 'jason' ? 'lucia' : 'jason';
    const look = { ...PROTAGONIST_INFO[partnerId].look };
    G.scene.remove(this.partnerPed.rig.root);
    this.partnerPed.look = look;
    this.partnerPed.rig = buildPerson(look, !!G.isSoftwareGl);
    G.scene.add(this.partnerPed.rig.root);
    this.partnerPed.sync(0);
  }

  public setRadarCanvas(canvas: HTMLCanvasElement | null): void {
    this.radarCanvas = canvas;
  }

  private handleResize(): void {
    const w = this.mountEl.clientWidth || window.innerWidth;
    const h = Math.max(1, this.mountEl.clientHeight || window.innerHeight);
    this.renderer.setSize(w, h);
    this.G.camera.aspect = w / h;
    this.G.camera.updateProjectionMatrix();
    const dpr = this.renderer.getPixelRatio();
    this.G.post.setSize(Math.max(2, Math.floor(w * dpr)), Math.max(2, Math.floor(h * dpr)));
    // Immediately re-render so resizing never leaves a blank cleared WebGL buffer
    this.G.post.render(this.G.scene, this.G.camera, performance.now() / 1000);
  }

  private syncBodyState(state: GameStateMode): void {
    document.body.dataset.state = state;
  }

  public startNewGame(): void {
    const G = this.G;
    G.audio.start();
    G.wanted.clear();
    G.missions.failMission('');
    G.missions.done = [];
    G.missions.conches.clear();
    G.economy.money = 2400;
    G.rep.points = 0;
    G.combat.owned = { fists: true, pistol: true };
    G.combat.ammo = { pistol: 72 };
    G.combat.index = 1;
    G.player.setProtagonist('jason', false);
    G.player.armor = 25;
    G.player.focus = 100;
    G.player.focusActive = false;
    G.player.stunt.nitro = 100;
    this.weaponWheelOpen = false;
    this.phoneOpen = false;
    if (G.player.vehicle) G.carjack.exit(true);
    const sh = PLACES.safehouse;
    respawnAt(G, sh.x - 14.0, sh.z + 5.2);
    G.player.heading = Math.PI * 0.42;
    G.player.ped.heading = Math.PI * 0.42;
    G.player.ped.sync(0);
    this.ensurePartnerAt(sh.x - 12.6, sh.z + 3.4, Math.PI * 0.62);
    G.cam.yaw = -0.34;
    G.cam.pitch = 0.16;
    G.cam.snap = true;
    // Set initial GPS route to Lou's Pier Lounge so the GTA radar immediately guides the story
    G.waypoint = { x: PLACES.lupeBar.x, z: PLACES.lupeBar.z };
    this.downedCause = null;
    G.mode = 'play';
    this.syncBodyState('playing');
    // Queue Bonnie & Clyde opening story dialogue
    this.dialogueQueue = [];
    this.dialogueTimer = 0;
    for (const [who, line] of PROLOGUE_LINES) {
      const c = CAST[who];
      G.ui.say(c.name, line, c.color);
    }
    G.ui.missionBanner(
      'CHAPTER I · VICE COAST',
      "Drive to Lou's Pier Lounge · [G] Switch Jason/Lucia · [TAB] Weapons · [T] Phone",
      'info',
    );
    this.emitHud();
  }

  public continueGame(): void {
    const G = this.G;
    G.audio.start();
    G.save.load();
    this.weaponWheelOpen = false;
    this.phoneOpen = false;
    this.downedCause = null;
    G.mode = 'play';
    this.syncBodyState('playing');
    const name = PROTAGONIST_INFO[G.player.protagonist as ProtagonistId].firstName;
    G.ui.toast(`Save Loaded · Welcome back, ${name}`, 'good');
    this.emitHud();
  }

  public setPaused(paused: boolean): void {
    const G = this.G;
    if (G.mode === 'title' || G.mode === 'down') return;
    G.mode = paused ? 'pause' : 'play';
    if (paused) {
      G.input.releaseAll();
      G.audio.silenceLoops();
      this.syncBodyState('paused');
    } else {
      this.syncBodyState('playing');
    }
    this.emitHud();
  }

  public returnToTitle(): void {
    const G = this.G;
    G.economy.closeShop();
    G.input.releaseAll();
    G.audio.silenceLoops();
    G.radio.carLeft();
    G.mode = 'title';
    this.downedCause = null;
    this.syncBodyState('title');
    this.emitHud();
  }

  public setWeather(mode: WeatherMode): void {
    this.G.sky.setWeather(mode, true);
    this.G.ui.toast(`Atmosphere · ${WEATHER_SPECS[mode].label}`, 'good');
    this.emitHud();
  }

  public cycleWeather(): void {
    const next: WeatherMode = this.G.sky.cycleWeather();
    this.G.ui.toast(`Atmosphere · ${WEATHER_SPECS[next].label}`, 'good');
    this.emitHud();
  }

  public cycleCamera(): void {
    const mode = this.G.cam.cycleMode();
    this.G.ui.toast(`Camera · ${mode.toUpperCase()}`);
    this.emitHud();
  }

  public toggleMute(): void {
    const muted = this.G.audio.toggleMute();
    this.G.ui.toast(muted ? 'Audio Muted' : 'Audio On');
    this.emitHud();
  }

  public nextRadio(): void {
    this.G.radio.next();
    this.emitHud();
  }

  public setWaypoint(x: number, z: number): void {
    this.G.waypoint = { x, z };
    this.G.ui.toast(`GPS Waypoint · ${streetAt(x, z)}`, 'good');
    this.emitHud();
  }

  public clearWaypoint(): void {
    this.G.waypoint = null;
    this.emitHud();
  }

  public switchProtagonist(): void {
    const G = this.G;
    if (G.mode !== 'play') return;
    const prevX = G.player.x;
    const prevZ = G.player.z;
    const prevH = G.player.heading;
    const swapPartnerPos =
      !G.player.vehicle &&
      this.partnerPed &&
      !this.partnerPed.dead &&
      Math.hypot(this.partnerPed.x - prevX, this.partnerPed.z - prevZ) < 42;

    if (swapPartnerPos && this.partnerPed) {
      const px = this.partnerPed.x;
      const pz = this.partnerPed.z;
      const ph = this.partnerPed.heading;
      G.player.switchProtagonist();
      G.player.place(px, pz, ph);
      G.player.ped.sync(0);
      this.ensurePartnerAt(prevX, prevZ, prevH);
    } else {
      G.player.switchProtagonist();
      this.syncPartnerWithProtagonist();
    }
    this.emitHud();
  }

  public toggleFocus(): void {
    this.G.player.toggleFocus();
    this.emitHud();
  }

  public setWeaponWheel(open: boolean): void {
    if (this.G.mode !== 'play') return;
    this.weaponWheelOpen = open;
    if (open) this.phoneOpen = false;
    this.emitHud();
  }

  public toggleWeaponWheel(): void {
    this.setWeaponWheel(!this.weaponWheelOpen);
  }

  public selectWeaponIndex(idx: number): void {
    if (this.G.combat.selectIndex(idx)) {
      this.G.audio?.pickup?.();
      this.weaponWheelOpen = false;
      this.emitHud();
    }
  }

  public togglePhone(open?: boolean): void {
    if (this.G.mode !== 'play') return;
    const next = open ?? !this.phoneOpen;
    this.phoneOpen = next;
    if (next) this.weaponWheelOpen = false;
    this.G.audio?.pickup?.();
    this.emitHud();
  }

  public trackViceGramPost(postId: string): void {
    const post = VICEGRAM_POSTS.find((p) => p.id === postId);
    if (!post) return;
    this.G.waypoint = { x: post.x, z: post.z };
    this.G.ui.toast(`ViceGram GPS · ${post.location}`, 'good');
    this.phoneOpen = false;
    this.emitHud();
  }

  public fastTravel(placeKey: string): void {
    const p = PLACES[placeKey];
    if (!p) return;
    const G = this.G;
    if (G.wanted.level > 0) {
      G.ui.toast('Lose VCPD heat before fast-traveling', 'bad');
      return;
    }
    if (G.player.vehicle) {
      G.player.vehicle.x = p.x - 4;
      G.player.vehicle.z = p.z + 2;
      G.player.vehicle.speed = 0;
      G.player.vehicle.y = 0;
      G.player.vehicle.sync(0);
    }
    G.player.place(p.x - 4, p.z + 2, 0);
    if (this.partnerPed) {
      this.partnerPed.x = p.x - 2.3;
      this.partnerPed.z = p.z + 2.6;
      this.partnerPed.sync(0);
    }
    G.cam.snap = true;
    this.phoneOpen = false;
    this.setPaused(false);
    G.ui.toast(`Arrived · ${p.label}`, 'good');
  }

  public callPersonalCar(tx?: number, tz?: number): void {
    const G = this.G;
    const P = G.player;
    const sx = tx ?? P.x + 5;
    const sz = tz ?? P.z + 3;
    const r = G.collision.resolve(sx, sz, 2.2);
    const unlockedHyper = G.missions.done.includes('m7') || G.rep.level >= 4;
    const model = unlockedHyper ? 'solaris' : 'comet';
    const paint = unlockedHyper ? '#ff8c42' : '#d7263d';
    const v = G.traffic.add(model, paint, r.x, r.z, P.heading, 'parked');
    v.setFinish(unlockedHyper ? 'pearl' : 'gloss');
    v.setUnderglow('#2df2e6', 1);
    v.nitroTier = Math.max(1, v.nitroTier);
    G.ui.toast(`${v.spec.name} Delivered Nearby`, 'good');
    if (G.mode === 'pause') this.setPaused(false);
  }

  public selectShopItem(id: string): void {
    this.G.economy.selectShopItem(id);
    this.emitHud();
  }

  public closeShop(): void {
    this.G.economy.closeShop();
    this.emitHud();
  }

  private handlePlayerDown(cause: 'wasted' | 'busted'): void {
    const G = this.G;
    if (G.mode === 'down') return;
    G.player.dead = true;
    G.economy.closeShop();
    G.input.releaseAll();
    G.audio.silenceLoops();
    G.audio.sting('fail');
    G.missions.failMission(cause === 'busted' ? 'Busted by VCPD' : 'Wasted');
    this.downedCause = cause;
    G.mode = 'down';
    this.syncBodyState('gameover');
    this.emitHud();
  }

  public recoverFromDown(): void {
    const G = this.G;
    const isBusted = this.downedCause === 'busted';
    const fee = Math.min(G.economy.money, isBusted ? 450 : 350);
    G.economy.money -= fee;
    G.wanted.clear();
    if (G.player.vehicle) G.carjack.exit(true);
    const target = isBusted ? PLACES.precinct : PLACES.hospital;
    respawnAt(G, target.x - 6, target.z + 4);
    this.downedCause = null;
    G.mode = 'play';
    this.syncBodyState('playing');
    G.ui.toast(
      isBusted
        ? `Released from Precinct · Bail -$${fee}`
        : `Discharged from Clinic · Bill -$${fee}`,
      'alert',
    );
    this.emitHud();
  }

  private advanceDialogue(): void {
    const next = this.dialogueQueue.shift() ?? null;
    this.callbacks.onDialogue(next);
    this.dialogueTimer = next ? 5.2 : 0;
  }

  private loop = (): void => {
    if (this.disposed) return;
    const now = performance.now();
    const rawDt = Math.min(0.05, Math.max(0.001, (now - this.lastTime) / 1000));
    this.lastTime = now;

    this.step(rawDt, now / 1000);
    this.pacer.scheduleNext(this.loop);
  };

  private step(dt: number, elapsedSec: number): void {
    const G = this.G;
    this.frameHint = '';

    if (this.dialogueTimer > 0) {
      this.dialogueTimer -= dt;
      if (this.dialogueTimer <= 0) this.advanceDialogue();
    }

    if (G.mode === 'title') {
      // Unobstructed coastal sunset flyover over Playa Celeste & Paseo del Malecón looking toward the Art-Deco hotels & Downtown Cristal skyline
      this.flyT += dt * 0.16;
      const cx = -44 + Math.sin(this.flyT * 0.7) * 14;
      const cz = 268 + Math.cos(this.flyT * 0.5) * 68;
      const cy = 22 + Math.sin(this.flyT * 1.1) * 4;
      G.camera.position.set(cx, cy, cz);
      G.camera.lookAt(92, 14, cz - 72);
      G.sky.update(dt, { x: 40, z: cz - 30 });
      G.city.update(G.sky, dt);
      G.props.update(dt, G.sky);
      G.post.render(G.scene, G.camera, elapsedSec);
      G.input.endFrame();
      return;
    }

    if (G.mode === 'play' && !G.economy.activeShop) {
      // Hitstop freeze frame for high-impact explosions & takedowns
      if (G.hitstop > 0) {
        G.hitstop = Math.max(0, G.hitstop - dt);
      }
      // Smooth GTA VI time-dilation for Radial Weapon Wheel (0.18x) & Focus Mode (0.38x)
      const timeScale = this.weaponWheelOpen
        ? 0.18
        : G.player.focusActive
          ? 0.38
          : 1.0;
      const simDt = G.hitstop > 0 ? 0 : dt * timeScale;

      // Subtle slow passage of golden hour unless locked to weather preset
      G.sky.hour = (G.sky.hour + simDt * 0.004) % 24;

      if (simDt > 0) {
        G.player.update(simDt, dt);
        if (!this.weaponWheelOpen && !this.phoneOpen) {
          G.combat.update(simDt);
        }
        G.traffic.update(simDt);
        G.pedSystem.update(simDt);
        G.police.update(simDt);
        G.wanted.update(simDt);
        G.missions.update(simDt);
        G.economy.update(simDt);
      }

      // Hide partner ped when player is driving so they seamlessly ride along
      if (this.partnerPed) {
        this.partnerPed.rig.root.visible = !G.player.vehicle;
        if (G.player.vehicle) {
          this.partnerPed.x = G.player.x + 2.2;
          this.partnerPed.z = G.player.z + 1.5;
        }
      }

      // Context hint for nearby vehicle when on foot
      if (!this.frameHint && !G.player.vehicle) {
        const nearCar = G.carjack.nearest(5.2);
        if (nearCar) {
          this.frameHint = `Press F · ${nearCar.driver ? 'Hijack' : 'Drive'} ${nearCar.spec.name}`;
        }
      }

      // Audio loops
      const v = G.player.vehicle;
      G.audio.setEngine(!!v && !v.dead, v ? v.speed : 0, v ? v.ctl.throttle : 0, !!v?.boosting);
      let nearCop = 999;
      for (const u of G.police.units) {
        if (!u.dead) nearCop = Math.min(nearCop, Math.hypot(u.x - G.player.x, u.z - G.player.z));
      }
      G.audio.siren(G.wanted.level > 0 ? nearCop : 999);
      G.audio.heli(
        G.police.heli.active
          ? Math.hypot(G.police.heli.x - G.player.x, G.police.heli.z - G.player.z)
          : 999,
      );
      G.radio.update();

      G.cam.update(dt);
      G.fx.update(simDt);
      G.sky.update(simDt, G.player);
      G.city.update(G.sky, simDt);
      G.props.update(simDt, G.sky);
    } else {
      // Paused, in shop, or downed: keep rendering crisp scene without advancing world
      G.sky.update(0.0001, G.player);
      G.props.update(0.0001, G.sky);
    }

    G.post.render(G.scene, G.camera, elapsedSec);

    // Draw GTA VI rectangular radar canvas smoothly every frame when playing
    if (this.radarCanvas && G.mode === 'play') {
      drawGtaRadar(this.radarCanvas, this.buildMinimapState());
    }

    // Throttle React HUD state updates to ~10Hz
    this.uiAcc += dt;
    if (this.uiAcc >= 0.1) {
      this.uiAcc = 0;
      this.emitHud();
    }

    G.input.endFrame();
  }

  private buildMinimapState(): MinimapState {
    const G = this.G;
    const v = G.player.vehicle;
    const cops: MinimapState['cops'] = [];
    for (const u of G.police.units) {
      if (!u.dead) cops.push({ x: u.x, z: u.z, heading: u.heading });
    }
    if (G.police.heli.active) {
      cops.push({ x: G.police.heli.x, z: G.police.heli.z, heading: 0, isHeli: true });
    }
    const traffic: NonNullable<MinimapState['traffic']> = [];
    for (const car of G.vehicles) {
      if (car === v || car.dead || car.role === 'police') continue;
      if (Math.hypot(car.x - G.player.x, car.z - G.player.z) < 220) {
        traffic.push({ x: car.x, z: car.z, heading: car.heading });
      }
    }
    return {
      px: G.player.x,
      pz: G.player.z,
      heading: G.player.heading,
      camYaw: G.cam.yaw,
      speedKmh: v ? Math.round(Math.abs(v.speed) * 3.6) : 0,
      inVehicle: !!v,
      wantedLevel: G.wanted.level,
      blips: G.missions.minimapBlips(),
      gpsTarget: G.missions.gpsTarget(),
      cops,
      traffic,
    };
  }

  public emitHud(): void {
    const G = this.G;
    const P = G.player;
    const v = P.vehicle;
    const distKey = districtAt(P.x, P.z);
    const dist = DISTRICTS[distKey];
    const w = G.combat.current();
    const rInfo = G.radio.info();
    const speedKmh = v ? Math.round(Math.abs(v.speed) * 3.6) : 0;
    const gear = !v
      ? 'N'
      : v.speed < -0.5
        ? 'R'
        : String(clamp(Math.floor(speedKmh / 36) + 1, 1, 6));

    const modeMap: Record<string, GameStateMode> = {
      title: 'title',
      play: 'playing',
      pause: 'paused',
      down: 'gameover',
    };

    const evadeDur = G.wanted.level > 0 ? 10 + G.wanted.level * 5 : 1;
    const pInfo = PROTAGONIST_INFO[P.protagonist as ProtagonistId];
    const weaponsList: WeaponWheelItem[] = WEAPONS.map((item, idx) => ({
      index: idx,
      id: item.id,
      name: item.name,
      role: item.role,
      owned: !!G.combat.owned[item.id],
      ammo: item.id === 'fists' ? null : (G.combat.ammo[item.id] ?? 0),
      dmg: item.dmg * item.pellets,
      rate: item.rate,
    }));

    this.callbacks.onHud({
      mode: modeMap[G.mode] ?? 'title',
      hasSave: G.save.hasSave(),
      money: G.economy.money,
      clock: G.sky.clockText(),
      weather: G.sky.weather,
      weatherLabel: WEATHER_SPECS[G.sky.weather as WeatherMode].label,
      districtName: dist.name,
      districtColor: dist.color,
      streetName: streetAt(P.x, P.z),
      protagonist: P.protagonist,
      protagonistName: pInfo.name,
      protagonistFirstName: pInfo.firstName,
      protagonistPerk: pInfo.perk,
      protagonistAccent: pInfo.accent,
      health: Math.round(P.health),
      armor: Math.round(P.armor),
      focus: Math.round(P.focus),
      focusActive: !!P.focusActive,
      stamina: P.stamina,
      repLevel: G.rep.level,
      repTitle: G.rep.title,
      repProgress: G.rep.progress,
      wantedLevel: G.wanted.level,
      wantedSeen: G.wanted.seen,
      wantedEvadePct: G.wanted.level > 0 ? clamp(G.wanted.evadeT / evadeDur, 0, 1) : 0,
      policeRoster: G.police.roster(),
      weaponName: w.name,
      weaponRole: w.role,
      weaponId: w.id,
      weaponAmmo: w.id === 'fists' ? null : (G.combat.ammo[w.id] ?? 0),
      weaponIndex: G.combat.index,
      ownedWeapons: WEAPONS.filter((x) => G.combat.owned[x.id]).map((x) => x.id),
      weaponsList,
      weaponWheelOpen: this.weaponWheelOpen,
      phoneOpen: this.phoneOpen,
      storyChapter: Math.min(STORY.length, G.missions.done.length + 1),
      inVehicle: !!v,
      vehicleName: v ? v.spec.name : '',
      vehicleSpeedKmh: speedKmh,
      vehicleHealthPct: v ? Math.round((v.health / v.maxHealth) * 100) : 100,
      vehicleGear: gear,
      vehicleNitro: clamp(P.stunt.nitro / 100, 0, 1),
      vehicleBoosting: P.stunt.boosting,
      vehicleNitroTier: v ? v.nitroTier : 0,
      vehicleFinish: v ? v.finish : 'gloss',
      driftScore: Math.round(P.stunt.comboPoints),
      comboMult: P.stunt.comboMult,
      airtime: P.stunt.airtime,
      cameraMode: G.cam.mode,
      muted: G.audio.muted,
      radioStation: rInfo.station,
      radioGenre: rInfo.genre,
      radioSong: rInfo.song,
      radioAccent: rInfo.accent,
      mission: G.missions.snapshot(),
      missionsDone: G.missions.done.length,
      missionsTotal: STORY.length,
      conchesFound: G.missions.conches.size,
      conchesTotal: SIDE.conches.length,
      totalStuntCash: P.stunt.totalDrifts + P.stunt.totalJumps,
      longestJump: Math.round(P.stunt.bestJumpMeters),
      longestDrift: P.stunt.totalDrifts,
      hint: this.frameHint,
      downedCause: this.downedCause,
      minimap: this.buildMinimapState(),
    });
  }

  public dispose(): void {
    this.disposed = true;
    this.pacer.cancel();
    this.resizeObs.disconnect();
    window.removeEventListener('keydown', this.onKeyDown);
    this.renderer.domElement.removeEventListener('webglcontextlost', this.onContextLost);
    this.renderer.domElement.removeEventListener('webglcontextrestored', this.onContextRestored);
    this.G.audio.silenceLoops();
    this.G.post.dispose();
    this.renderer.dispose();
  }
}
