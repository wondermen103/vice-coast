// ShotScenes: ?shot=cover|city|mission|garage|map stages a moment with the game's own systems (real
// cars, police AI, missions, shops, HUD), steps the simulation, renders, and flags the page ready.
import {
    STORY,
    CAST,
    PLACES
} from '../missions/StoryMissions.js';

function warm(G, frames) {
    for (let i = 0; i < frames; i++) {
        G.time += 1 / 30;
        G.step(1 / 30);
    }
}

function finish(G) {
    if (G.cam.override) G.cam.update(0);
    document.querySelectorAll('.banner, .toast').forEach((b) => b.remove());
    G.hud.shownMoney = G.economy.money;
    G.hud.update(0.016);
    G.minimap.update(1);
    G.render();
    G.render();
    setTimeout(() => {
        G.render();
        document.body.dataset.ready = '1';
    }, 400);
}

// clears the city's own kerbside cars from a stretch of road before a scene poses its own
function clearParked(G, x, z, r) {
    for (let i = G.vehicles.length - 1; i >= 0; i--) {
        const v = G.vehicles[i];
        if (v.role === 'parked' && !v.frozen && v.driver !== 'player' && Math.hypot(v.x - x, v.z - z) < r) {
            v.dispose();
            G.vehicles.splice(i, 1);
        }
    }
}

function startMissionAt(G, index, step) {
    G.missions.progress = index;
    G.missions.start(index);
    while (G.missions.step < step) G.missions.next();
    G.hud.lines = [];
}

const SCENES = {
    cover(G, aerial = false) {
        G.setup(3.2, 420, 0.03, 18.8);
        G.economy.money = 86250;
        G.player.armor = 60;
        G.player.health = 82;
        G.rep.points = 1640;
        for (const k of ['smg', 'shotgun']) G.economy.unlocked.add(k); // Shot Caller, the Breaker on sale, the Kestrel still story-locked
        const car = G.traffic.add('comet', '#e0262f', 3.2, 420, 0.03, 'parked');
        G.carjack.enter(car);
        car.frozen = true;
        car.speed = 31.4;
        car.ctl.throttle = 1;
        car.steer = 0.12;
        G.combat.give('smg', 150);
        G.combat.index = 2;
        startMissionAt(G, 7, 3); // Golden Hour, escape step
        G.wanted.setLevel(aerial ? 5 : 4);
        const P = G.police;
        if (aerial)
            for (const [x, z, h] of [
                    [0.5, 436, 0.05],
                    [5.2, 447, -0.06],
                    [-1.8, 455, 0.1]
                ]) {
                const u = P.addUnit('police', x, z, h);
                u.frozen = true;
                u.speed = 30;
            }
        for (const [x, z, h] of [
                [-1.5, 418.0, -0.1],
                [-1.4, 399, 0.26],
                [7.0, 410.5, -0.22]
            ]) {
            const u = P.addUnit('police', x, z, h);
            u.frozen = true;
            u.speed = 28;
        }
        for (const [x, h] of [
                [-3.4, Math.PI / 2 + 0.25],
                [3.4, -Math.PI / 2 - 0.2]
            ]) {
            const u = P.addUnit('police', x, 330, h);
            u.frozen = true;
            u.roadblock = true;
        }
        const sw = P.addUnit('swat', -4.4, 350, Math.PI / 2 - 0.4);
        sw.frozen = true;
        sw.roadblock = true;
        const onc = G.traffic.add('marea', '#2e86de', -3.6, 372, Math.PI, 'traffic');
        onc.frozen = true;
        P.heli.setActive(true);
        P.heli.frozen = true;
        P.heli.x = aerial ? 0.5 : -1.5;
        P.heli.z = aerial ? 401 : 404;
        P.heli.y = aerial ? 10.5 : 8.6;
        P.heli.heading = -2.3;
        for (let i = 0; i < 9; i++) {
            const p = G.pedSystem.addCiv(i % 3 === 0 ? 11 : -10.5 - (i % 2) * 1.5, 396 + i * 2.6);
            p.state = 'flee';
            p.fleeT = 20;
            p.threat = [3, 430];
        }
        G.radio.on = true;
        G.radio.station = 0;
        G.radio.song = 1;
        G.cam.override = aerial ?
            (cam) => {
                cam.position.set(-15, 31, 462);
                cam.lookAt(1.5, 0, 402);
                cam.fov = 55;
                cam.updateProjectionMatrix();
            } // the city from the Air-1 side
            :
            (cam) => {
                cam.position.set(5.0, 1.5, 425.5);
                cam.lookAt(-0.6, 3.4, 396);
                cam.rotateZ(0.07);
                cam.fov = 74;
                cam.updateProjectionMatrix();
            }; // lower, closer, a dutch tilt: the Comet and the ramming cruiser fill the frame
        G.post.params.speedBlur = 0.75;
        warm(G, 20);
        for (let i = 0; i < 18; i++) G.fx.tyreSmoke(3.2 + (Math.random() - 0.5) * 2, 423 + Math.random() * 3);
        // drive-by: Nico fires the Mako out of the window at the flanking cruiser
        G.fx.muzzle(2.15, 1.35, 419.2);
        for (let i = 0; i < 4; i++) G.fx.tracer(2.1, 1.35, 419.3 - i * 0.2, -1.6 + Math.random() * 0.8, 1.0 + Math.random() * 0.4, 418.2 + Math.random(), 0xffd27a);
        G.fx.sparks(-1.4, 1.1, 418.4, 16);
        G.fx.update(0.03);
        G.hud.lines = [];
        G.hud.lineT = 0;
        G.missions.timer = 107; // 1:47 left on the boat's clock
        G.hud.say(CAST.marco.short, 'The boat sails in two minutes, Nico! Shake that chopper and get to the pier!', CAST.marco.color);
        G.post.params.speedBlur = aerial ? 0 : 0.45;
        Object.assign(G.post.params, {
            exposure: 0.8,
            saturation: 1.38
        });
        G.post.params.tint.setRGB(1.07, 0.96, 0.86); // warmer, punchier grade for the hero shot
        G.hud.wantedUp(G.wanted.level);
        clearTimeout(G.hud.wt);
        G.hud.el['wanted-banner'].classList.remove('pulse');
        G.hud.el['wanted-banner'].style.top = '58px'; // the banner held at rest, clear of Air-1
        if (!aerial) {
            P.heli.group.scale.setScalar(1.75);
            P.heli.group.position.z += 3;
            P.heli.group.position.x += 1.2;
            P.heli.group.position.y -= 0.4;
            P.heli.group.updateMatrixWorld(true);
        }
        if (!aerial) P.heli.cone.material.opacity = 0.045; // the camera sits inside the beam: keep it from fogging the frame
        finish(G);
    },

    city(G) {
        G.setup(271.6, 441.2, Math.PI / 2 - 0.08, 18.95); // late golden hour: lit windows and headlights against the last sun
        G.economy.money = 12480;
        G.missions.progress = 2;
        G.rep.points = 205;
        G.cam.yaw = Math.PI / 2 - 0.12;
        G.cam.pitch = 0.08;
        G.traffic.add('palma', '#ff6f91', 268, 438.4, Math.PI / 2, 'parked');
        for (const [x, d] of [
                [240, 1],
                [205, 1],
                [300, -1]
            ]) {
            const v = G.traffic.add(d > 0 ? 'taxi' : 'tortuga', d > 0 ? '#f7b32b' : '#3ec1d3', x, 432 + d * 3.6, d > 0 ? -Math.PI / 2 : Math.PI / 2, 'traffic');
            v.lane = {
                axis: 'x',
                k: 6,
                dir: d
            };
            v.driver = 'ai';
            v.speed = 9;
            v.cruise = 9;
        }
        for (let i = 0; i < 12; i++) G.pedSystem.addCiv(200 + i * 7.5, i % 2 ? 442 : 422);
        for (let i = 0; i < 14; i++) G.pedSystem.addCiv(255 + i * 4.5, i % 2 ? 443.5 : 424.5);
        for (const [x, d, m, col] of [
                [290, 1, 'marea', '#2e86de'],
                [255, -1, 'palma', '#7bd389'],
                [320, 1, 'comet', '#ffd166']
            ]) G.traffic.add(m, col, x, 432 + d * 3.6, d > 0 ? -Math.PI / 2 : Math.PI / 2, 'traffic');
        const patrol = G.traffic.add('police', '#ffffff', 284, 428.4, -Math.PI / 2, 'parked');
        patrol.frozen = true; // a PCPD cruiser on patrol, no heat yet
        for (const [x, m, col] of [
                [278, 'taxi', '#f7b32b'],
                [292, 'aureo', '#e8b43a']
            ]) {
            const v = G.traffic.add(m, col, x, 435.6, Math.PI / 2, 'parked');
            v.frozen = true;
            v.speed = 10;
        } // oncoming in the near lane
        G.cam.override = (cam) => {
            cam.position.set(262, 4.6, 442.4);
            cam.lookAt(300, 2.0, 429.6);
            cam.fov = 62;
            cam.updateProjectionMatrix();
        };
        Object.assign(G.post.params, {
            exposure: 0.84,
            saturation: 1.3
        });
        G.post.params.tint.setRGB(1.06, 0.97, 0.9);
        warm(G, 45);
        G.props.beam.visible = false; // the lighthouse sweep would cross this street
        G.hud.lines = [];
        G.hud.lineT = 0;
        finish(G);
    },

    // the Malecón by day: a just-stolen Palma Cabrio with Nico at the wheel, beach, umbrellas, cabs, and the first cruiser on his tail
    boulevard(G) {
        const H = 0.02,
            X = 3.4,
            Z = 262;
        G.setup(X, Z, H, 16.2);
        clearParked(G, X, Z, 40);
        G.economy.money = 18350;
        G.missions.progress = 3;
        G.rep.points = 340;
        G.player.armor = 20;
        const car = G.traffic.add('palma', '#ff4f3a', X, Z, H, 'parked');
        car.driver = 'ai';
        G.carjack.enter(car);
        car.frozen = true;
        car.speed = 19;
        car.ctl.throttle = 1;
        car.steer = 0.05;
        for (const [m, col, x, z, h, sp] of [
                ['taxi', '#f7b32b', 3.6, 236, 0, 14],
                ['marea', '#7bd389', -3.4, 222, Math.PI, 12],
                ['taxi', '#f7b32b', -3.6, 248, Math.PI, 13],
                ['tortuga', '#3ec1d3', 3.3, 205, 0, 12],
                ['comet', '#ffd166', -3.5, 196, Math.PI, 15]
            ]) {
            const v = G.traffic.add(m, col, x, z, h, 'parked');
            v.frozen = true;
            v.speed = sp;
        }
        for (let i = 0; i < 16; i++) {
            const p = G.pedSystem.addCiv(i % 2 ? -9.5 - (i % 3) : 10.5 + (i % 3) * 0.8, 200 + i * 4.2);
            p.state = 'idle';
        }
        for (let i = 0; i < 6; i++) {
            const p = G.pedSystem.addCiv(-17 - (i % 3) * 4, 214 + i * 7);
            p.state = 'idle';
        } // on the sand
        G.wanted.setLevel(1);
        const u = G.police.addUnit('police', -2.6, 238, Math.PI - 0.12);
        u.frozen = true;
        u.speed = 20; // the responding cruiser, swinging across to cut him off
        // over the shoulder of the cabrio: Nico at the wheel, the boulevard, beach and palms ahead
        G.cam.override = (cam) => {
            cam.position.set(6.4, 2.9, 271.5);
            cam.lookAt(-1.8, 1.0, 249);
            cam.fov = 60;
            cam.updateProjectionMatrix();
        };
        Object.assign(G.post.params, {
            exposure: 0.9,
            saturation: 1.32
        });
        G.post.params.tint.setRGB(1.04, 0.99, 0.94);
        warm(G, 20);
        G.hud.lines = [];
        G.hud.lineT = 0;
        finish(G);
        G.hud.toast('VEHICLE STOLEN · Palma Cabrio', 'alert', 60000);
        G.hud.toast('A witness called the PCPD', 'bad', 60000);
    },

    mission(G) {
        G.setup(522, 438, -Math.PI / 2 + 0.05, 18.45);
        G.economy.money = 41900;
        G.player.health = 64;
        G.player.armor = 35;
        G.rep.points = 760;
        G.economy.unlocked.add('smg');
        G.combat.give('smg', 150);
        G.combat.index = 2;
        startMissionAt(G, 5, 0);
        const gang = G.missions.spawned;
        gang.forEach((p, i) => {
            p.x = 533 + (i % 4) * 2.6;
            p.z = 430 + i * 2.2;
            p.state = 'attack';
        });
        for (let i = 0; i < 3; i++) gang[i].hurt(999, true);
        const wreck = G.traffic.add('van', '#3d7f86', 554, 441, 0.9, 'parked');
        wreck.explode(); // behind the gang's car, so the fire backlights the fight
        G.police.clearAll();
        G.wanted.clear();
        G.cam.yaw = -Math.PI / 2 + 0.12;
        G.cam.pitch = 0.1;
        G.input.mouse.right = true;
        G.input.mouse.left = true;
        G.godMode = true;
        const cover = G.traffic.add('tortuga', '#1f9fb8', 541, 437.5, 0.25, 'parked');
        cover.frozen = true; // the Tiburones' car, used as cover
        warm(G, 26);
        G.police.clearAll();
        G.wanted.clear();
        G.player.place(526.4, 440.9, -Math.PI / 2 + 0.2);
        G.step(1 / 30);
        // the live Tiburones regroup around their car, firing back at Nico
        const live = gang.filter((p) => !p.dead);
        // (tried: posing them behind the car hides them at 256 px; they stay where the attack AI put them, in the open beside it)
        // the van behind them goes up: a fireball and black smoke centred over the docks (aged first, so the gunfire below stays live)
        G.fx.explosion(553, 2.8, 440);
        G.fx.update(0.12);
        for (let i = 0; i < 10; i++) {
            G.fx.fire(553 + (Math.random() - 0.5) * 3, 2.4, 440 + (Math.random() - 0.5) * 2);
            G.fx.smoke(553.5, 3 + i * 0.7, 440.5, true);
            G.fx.update(0.06);
        }
        for (const p of live) {
            G.fx.muzzle(p.x - 0.4, 1.3, p.z);
            G.fx.tracer(p.x - 0.4, 1.3, p.z, 523 + Math.random() * 2, 1.2, 437 + Math.random() * 3, 0xff7a59);
        }
        G.fx.sparks(541, 1.0, 437.5, 14);
        // Nico's Mako answers: muzzle flash and a burst of tracers into the Tiburones' cover
        G.fx.muzzle(527.6, 1.35, 440.3);
        for (let i = 0; i < 5; i++) G.fx.tracer(527.6, 1.35, 440.3, 538 + Math.random() * 6, 0.9 + Math.random() * 0.6, 433 + Math.random() * 9, 0xffd27a);
        G.fx.update(0.01);
        Object.assign(G.post.params, {
            exposure: 0.78,
            saturation: 1.36
        });
        G.post.params.tint.setRGB(1.08, 0.97, 0.88);
        G.cam.override = (cam) => {
            cam.position.set(522.5, 1.6, 446);
            cam.lookAt(536, 1.4, 437);
            cam.fov = 44;
            cam.updateProjectionMatrix();
        }; // side-on: Nico in profile firing left, the Tiburones and the fire right
        G.hud.lines = [];
        G.hud.lineT = 0;
        G.hud.say(CAST.marco.short, 'Three left by their car! Keep that Mako singing, Varela!', CAST.marco.color);
        finish(G);
    },

    aerial(G) {
        SCENES.cover(G, true);
    },

    // Sully's Spray & Tune: Nico's Aureo GT on the forecourt, the real upgrade menu open with its prices and stat bars
    garage(G) {
        const [gx, gz] = PLACES.sully, H = -Math.PI / 2 + 0.55;
        G.setup(gx, gz, H, 18.55);
        G.economy.money = 64300;
        G.missions.progress = 6;
        G.economy.unlocked.add('garage');
        G.rep.points = 1180;
        const car = G.traffic.add('aureo', '#e8b43a', gx, gz, H, 'parked');
        G.carjack.enter(car);
        car.frozen = true;
        car.speed = 0;
        car.upgrade = 1;
        car.armor = 1;
        for (const [m, col, dx, dz, h] of [
                ['comet', '#e0262f', -6.5, -5, 0.4],
                ['palma', '#ff6f91', -9, 2.5, 1.2],
                ['tortuga', '#3ec1d3', 5, -8, -0.3]
            ]) {
            const v = G.traffic.add(m, col, gx + dx, gz + dz, h, 'parked');
            v.frozen = true;
        } // the rest of Nico's garage
        G.police.heli.setActive(false);
        G.wanted.clear();
        G.police.clearAll();
        // a front three-quarter of the Aureo, the frame shifted so the car fills the left and the menu the right
        G.cam.override = (cam) => {
            cam.position.set(gx + 5.92, 1.5, gz + 1.83);
            cam.lookAt(gx, 0.2, gz);
            cam.fov = 50;
            cam.setViewOffset(1280, 800, 300, 40, 1280, 800);
            cam.updateProjectionMatrix();
        };
        Object.assign(G.post.params, {
            exposure: 0.82,
            saturation: 1.34
        });
        G.post.params.tint.setRGB(1.07, 0.97, 0.88);
        warm(G, 20);
        G.economy.show('sully');
        G.hud.lines = [];
        G.hud.lineT = 0;
        G.hud.hintT = 0;
        G.hud.hintText = '';
        finish(G);
    },

    // Boardwalk Rush side race: time trial through the checkpoint beams, with street racers alongside
    race(G) {
        const H = Math.PI;
        G.setup(144, 150, H, 18.5);
        G.economy.money = 23900;
        G.missions.progress = 3;
        const car = G.traffic.add('aureo', '#e8b43a', 144, 150, H, 'parked');
        G.carjack.enter(car);
        car.frozen = true;
        car.speed = 27;
        car.ctl.throttle = 1;
        G.missions.startRace();
        G.missions.race.cp = 5;
        G.missions.race.time = 31.4;
        for (const [x, z, m, col] of [
                [147.4, 154.5, 'comet', '#ff3b7a'],
                [140.8, 159, 'palma', '#4fd1ff'],
                [146.6, 166, 'comet', '#7bd389']
            ]) {
            const v = G.traffic.add(m, col, x, z, H + 0.04, 'parked');
            v.frozen = true;
            v.speed = 26;
        }
        for (let i = 0; i < 10; i++) {
            const p = G.pedSystem.addCiv(i % 2 ? 136 : 152, 160 + i * 4);
            p.state = 'idle';
        }
        G.cam.override = (cam) => {
            cam.position.set(141.5, 2.6, 142.5);
            cam.lookAt(145, 1.6, 185);
            cam.fov = 70;
            cam.updateProjectionMatrix();
        };
        G.post.params.speedBlur = 0.4;
        warm(G, 12);
        for (let i = 0; i < 10; i++) G.fx.tyreSmoke(144 + (Math.random() - 0.5) * 2, 148 + Math.random() * 2);
        G.hud.lines = [];
        G.hud.lineT = 0;
        finish(G);
    },

    map(G) {
        G.setup(150, 216, 1.2, 18.9);
        G.economy.money = 58700;
        G.missions.progress = 5;
        G.missions.shells = new Set([0, 1, 2, 4, 6, 9]);
        Object.assign(G.stats, {
            missions: 5,
            kills: 37,
            escapes: 9,
            races: 2
        });
        G.economy.unlocked.add('garage');
        const car = G.traffic.add('aureo', '#e8b43a', 150, 216, -1.2, 'parked');
        G.carjack.enter(car);
        warm(G, 30);
        G.setPaused(true);
        finish(G);
    },
};

export function runShot(G, name) {
    (SCENES[name] || SCENES.cover)(G);
    void STORY;
    void PLACES;
}