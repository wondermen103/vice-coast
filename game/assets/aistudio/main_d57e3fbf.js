// Golden Hour Kings: Puerto Celeste. Boot: builds every system into one context G and runs the loop.
import * as THREE from 'three';
import {
    MissionDirector
} from './missions/MissionDirector.js';
import {
    PLACES,
    CAST
} from './missions/StoryMissions.js';
import {
    WantedSystem
} from './police/WantedSystem.js';
import {
    PoliceDispatch
} from './police/PoliceDispatch.js';
import {
    PlayerController,
    respawnAt
} from './player/PlayerController.js';
import {
    Carjacking
} from './vehicles/Carjacking.js';
import {
    Combat
} from './combat/Weapons.js';
import {
    Economy
} from './economy/ShopsAndGarage.js';
import {
    Reputation
} from './progression/Reputation.js';
import {
    SaveGame
} from './save/SaveGame.js';
import {
    Hud
} from './ui/Hud.js';
import {
    Minimap
} from './ui/Minimap.js';
import {
    Menus
} from './ui/Menus.js';
import {
    ChaseCamera
} from './camera/ChaseCamera.js';
import {
    AudioEngine
} from './audio/AudioEngine.js';
import {
    RadioSynth
} from './audio/RadioSynth.js';
import {
    Particles
} from './fx/Particles.js';
import {
    Collision
} from './world/Collision.js';
import {
    PostFX
} from './render/PostFX.js';
import {
    SkyAndSun
} from './world/SkyAndSun.js';
import {
    CityBuilder
} from './world/CityBuilder.js';
import {
    Props
} from './world/Props.js';
import {
    TrafficSystem
} from './traffic/TrafficAI.js';
import {
    PedSystem
} from './people/Pedestrians.js';
import {
    Input,
    Events
} from './core/Input.js';
import {
    runShot
} from './shots/ShotScenes.js';

const canvas = document.getElementById('view');
const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: false,
    powerPreference: 'high-performance',
    preserveDrawingBuffer: true
});
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(62, 16 / 10, 0.3, 1600);

const G = window.G = {
    THREE,
    renderer,
    scene,
    camera,
    events: new Events(),
    input: new Input(canvas),
    mode: 'title',
    time: 0,
    stats: {
        missions: 0,
        kills: 0,
        escapes: 0,
        races: 0
    },
};
G.post = new PostFX(renderer);
G.collision = new Collision();
G.sky = new SkyAndSun(G);
G.city = new CityBuilder(G).build();
G.props = new Props(G).build(G.city);
G.fx = new Particles(G);
G.audio = new AudioEngine();
G.radio = new RadioSynth(G.audio);
G.pedSystem = new PedSystem(G);
G.traffic = new TrafficSystem(G);
G.player = new PlayerController(G);
G.cam = new ChaseCamera(G);
G.carjack = new Carjacking(G);
G.combat = new Combat(G);
G.police = new PoliceDispatch(G);
G.wanted = new WantedSystem(G);
G.economy = new Economy(G);
G.rep = new Reputation(G);
G.missions = new MissionDirector(G);
G.hud = new Hud(G);
G.minimap = new Minimap(G);
G.menus = new Menus(G);
G.save = new SaveGame(G);
G.traffic.init();

G.quality = 1; // adaptive render scale: drops when frames run slow
function resize() {
    const w = innerWidth,
        h = innerHeight,
        pr = Math.min(devicePixelRatio || 1, 1.5) * G.quality;
    renderer.setPixelRatio(pr);
    renderer.setSize(w, h, false);
    G.post.setSize(Math.floor(w * pr), Math.floor(h * pr));
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
}
addEventListener('resize', resize);
resize();
for (const ev of ['pointerdown', 'keydown']) addEventListener(ev, () => {
    if (G.mode !== 'title') G.audio.start();
});

G.setup = (x, z, h, hour) => {
    G.mode = 'play';
    G.menus.hideTitle();
    G.hud.show(true);
    G.player.place(x, z, h);
    G.sky.hour = hour;
    G.cam.yaw = h;
    G.cam.snap = true;
};
G.newGame = () => {
    G.audio.start();
    G.input.lockAllowed = true;
    const [x, z] = PLACES.safehouse;
    G.setup(x - 6, z, Math.PI / 2, 17.4);
    G.economy.money = 500;
    G.traffic.add('comet', '#d7263d', x - 10, z + 6, 0, 'parked');
    G.hud.say(CAST.lupe.short, 'Nico, it is Lupe. Welcome home. Come see me at the tattoo shop on Neon Row.', CAST.lupe.color);
    G.hud.say('Tip', 'F steals a car · M opens the map · the yellow beam marks your next job.', '#9fe0ff');
};
G.continueGame = () => {
    G.newGame();
    G.save.load();
    G.cam.snap = true;
    G.hud.toast('Welcome back', 'good');
};
G.setPaused = (on) => {
    G.mode = on ? 'paused' : 'play';
    G.menus.pause(on);
    if (on) document.exitPointerLock ? .();
};

G.events.on('playerDown', ({
    cause
}) => {
    const P = G.player;
    if (P.dead) return;
    if (P.vehicle) G.carjack.exit(true);
    P.dead = true;
    P.ped.dead = true;
    G.missions.onPlayerDown();
    G.menus.down(cause);
    G.audio.sting('fail');
    setTimeout(() => {
        G.wanted.clear();
        G.police.clearAll();
        if (cause === 'busted') {
            G.economy.money = Math.floor(G.economy.money * 0.9);
            const p = PLACES.brandt;
            respawnAt(G, p[0], p[1] - 4);
        } else {
            G.economy.money = Math.max(0, G.economy.money - 500);
            const p = PLACES.clinic;
            respawnAt(G, p[0], p[1] - 4);
        }
    }, 3400);
});

function titleCamera(dt) {
    G.time += dt;
    const t = G.time * 0.05,
        z = 360 - t * 60;
    camera.position.set(-30 + Math.sin(t) * 6, 16, z);
    camera.lookAt(30, 10, z - 70);
    G.player.x = 40;
    G.player.z = z - 60;
}

function step(dt) {
    const I = G.input,
        P = G.player;
    if (G.mode === 'play') {
        G.sky.hour = (G.sky.hour + dt / 60) % 24;
        if ((I.pressed('Escape') && !G.economy.open) || I.pressed('KeyP') || I.pressed('KeyM') || I.pressed('Tab')) {
            G.setPaused(true);
            I.endFrame();
            return;
        }
        P.update(dt);
        G.combat.update(dt);
    }
    if (G.mode !== 'paused') {
        G.traffic.update(dt);
        G.pedSystem.update(dt);
        if (G.mode === 'play') {
            G.police.update(dt);
            G.wanted.update(dt);
            G.missions.update(dt);
            G.economy.update(dt);
        }
        G.fx.update(dt);
    } else if (I.pressed('Escape') || I.pressed('KeyP') || I.pressed('KeyM') || I.pressed('Tab')) G.setPaused(false);
    if (G.mode === 'title') titleCamera(dt);
    else G.cam.update(dt);
    G.sky.update(dt, P);
    G.city.update(G.sky);
    G.props.update(dt, G.sky);
    if (G.mode === 'play') {
        const v = P.vehicle;
        G.audio.setEngine(!!v, v ? v.speed : 0, v ? v.ctl.throttle : 0);
        G.radio.update();
        G.hud.update(dt);
        G.minimap.update(dt);
    }
    I.endFrame();
}

G.render = () => G.post.render(scene, camera, G.time);
G.step = step;

const shot = new URLSearchParams(location.search).get('shot');
if (shot) runShot(G, shot);
else {
    G.menus.title(G.save.exists());
    let last = performance.now();
    let slow = 0,
        avg = 1 / 60;
    const loop = (now) => {
        const raw = (now - last) / 1000,
            dt = Math.min(0.05, raw);
        last = now;
        avg += (raw - avg) * 0.05;
        slow = avg > 1 / 32 ? slow + raw : 0;
        if (slow > 2 && G.quality > 0.6) {
            G.quality = Math.round((G.quality - 0.1) * 10) / 10;
            slow = 0;
            resize();
        }
        G.time += G.mode === 'play' ? dt : 0;
        step(dt);
        G.render();
        requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
}