// MissionDirector: giver markers, mission steps, timers, pass/fail, rewards; side race and Golden Conches.
import * as THREE from 'three';
import {
    STORY,
    SIDE,
    CAST,
    PLACES,
    GANG_LOOK,
    GUARD_LOOK,
    AURORA_LOOK
} from './StoryMissions.js';
import {
    glowTexture
} from '../render/Textures.js';
import {
    formatMoney
} from '../core/MathUtil.js';

const LOOKS = {
    gang: GANG_LOOK,
    guard: GUARD_LOOK,
    aurora: AURORA_LOOK
};

class Beam {
    constructor(scene, color) {
        this.g = new THREE.Group();
        const c = new THREE.Color(color);
        this.col = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 40, 20, 1, true), new THREE.MeshBasicMaterial({
            color: c.clone().multiplyScalar(1.6),
            transparent: true,
            opacity: 0.32,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            side: THREE.DoubleSide,
            fog: false
        }));
        this.col.position.y = 20;
        this.ring = new THREE.Mesh(new THREE.RingGeometry(2.2, 3, 32), new THREE.MeshBasicMaterial({
            color: c.clone().multiplyScalar(3),
            transparent: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            side: THREE.DoubleSide
        }));
        this.ring.rotation.x = -Math.PI / 2;
        this.ring.position.y = 0.3;
        this.halo = new THREE.Sprite(new THREE.SpriteMaterial({
            map: glowTexture(),
            color: c,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        }));
        this.halo.scale.set(9, 9, 1);
        this.halo.position.y = 1.5;
        this.g.add(this.col, this.ring, this.halo);
        this.g.visible = false;
        scene.add(this.g);
    }
    show(x, z, t) {
        this.g.visible = true;
        this.g.position.set(x, 0, z);
        this.ring.scale.setScalar(1 + Math.sin(t * 4) * 0.08);
    }
    hide() {
        this.g.visible = false;
    }
}

export class MissionDirector {
    constructor(G) {
        this.G = G;
        this.progress = 0;
        this.active = null;
        this.step = 0;
        this.t = 0;
        this.spawned = [];
        this.timer = 0;
        this.shells = new Set();
        this.raceBest = null;
        this.race = null;
        this.giverBeam = new Beam(G.scene, '#ffcc33');
        this.goalBeam = new Beam(G.scene, '#ffd84a');
        this.sideBeam = new Beam(G.scene, '#55d6ff');
        this.cpBeam = new Beam(G.scene, '#ff4fd8');
        this.shellSprites = SIDE.shells.map(([x, z]) => {
            const s = new THREE.Sprite(new THREE.SpriteMaterial({
                map: glowTexture(),
                color: new THREE.Color(2.5, 1.8, 0.6),
                blending: THREE.AdditiveBlending,
                depthWrite: false
            }));
            s.position.set(x, 1.2, z);
            s.scale.setScalar(1.6);
            G.scene.add(s);
            return s;
        });
    }

    current() {
        return STORY[this.progress];
    }
    place(key) {
        return PLACES[key];
    }
    stepPos(s) {
        return s.pos || (s.at && PLACES[s.at]) || (s.t === 'steal' && this.vehicle ? [this.vehicle.x, this.vehicle.z] : null);
    }

    start(i) {
        const G = this.G,
            m = STORY[i];
        this.active = m;
        this.step = -1;
        this.t = 0;
        this.spawned = [];
        this.vehicle = null;
        this.companion = null;
        G.hud.missionBanner('MISSION ' + (i + 1) + ' · ' + m.title.toUpperCase(), CAST[m.giver].name, 'start');
        for (const [who, line] of m.intro) G.hud.say(CAST[who].short || CAST[who].name, line, CAST[who].color);
        G.audio ? .sting('start');
        this.next();
    }

    next() {
        const G = this.G,
            m = this.active;
        this.step++;
        if (this.step >= m.steps.length) return this.pass();
        const s = m.steps[this.step];
        this.timer = s.time || 0;
        this.cp = 0;
        if (s.wanted) G.wanted.setLevel(s.wanted);
        if (s.t === 'kill') {
            const look = LOOKS[s.look || 'gang'];
            for (let i = 0; i < s.n; i++) {
                const a = (i / s.n) * Math.PI * 2,
                    p = G.pedSystem.addArmed(s.pos[0] + Math.cos(a) * 6, s.pos[1] + Math.sin(a) * 6, 'gang', { ...look,
                        skin: ['#b97850', '#8a5636', '#f1c7a5', '#d9a07a'][i % 4]
                    });
                p.mission = true;
                this.spawned.push(p);
            }
        }
        if (s.t === 'steal') {
            this.vehicle = G.traffic.add(s.model, s.paint, s.pos[0], s.pos[1], s.h, 'mission');
            this.spawned.push(this.vehicle);
        }
        if (s.t === 'escape') G.wanted.setLevel(Math.max(G.wanted.level, s.level));
        if (s.t === 'companion') {
            const [x, z] = PLACES[s.at];
            this.companion = G.pedSystem.addArmed(x, z + 2, 'npc', LOOKS[s.look]);
            this.companion.state = 'idle';
            this.spawned.push(this.companion);
        }
    }

    objective() {
        if (this.race) return {
            tag: 'SIDE JOB · ' + SIDE.race.title.toUpperCase(),
            text: 'Checkpoint ' + (this.race.cp + 1) + '/' + SIDE.race.cps.length,
            sub: this.race.time.toFixed(1) + 's left'
        };
        if (!this.active) {
            const m = this.current();
            return m ? {
                tag: 'NEXT: ' + m.title.toUpperCase(),
                text: 'Meet ' + CAST[m.giver].short + ' at ' + PLACES[m.giver][2],
                sub: ''
            } : {
                tag: 'PUERTO CELESTE',
                text: 'The city is yours',
                sub: ''
            };
        }
        const m = this.active,
            s = m.steps[this.step] || {
                text: ''
            },
            W = this.G.wanted;
        let sub = '';
        if (s.t === 'kill') sub = this.spawned.filter((p) => p.dead).length + '/' + s.n + ' down';
        if (s.t === 'race') sub = 'Checkpoint ' + (this.cp + 1) + '/' + s.cps.length;
        if (s.t === 'escape') sub = W.seen ? 'They can see you · break line of sight' : 'Out of sight · evading ' + Math.round(W.evadeProgress() * 100) + '%';
        // stage bar, countdown and the step after this one: the whole job reads at a glance
        const after = m.steps[this.step + 1];
        return {
            tag: m.title.toUpperCase(),
            job: 'JOB ' + (STORY.indexOf(m) + 1) + '/' + STORY.length,
            giver: CAST[m.giver].short,
            text: s.text,
            sub,
            stage: this.step + 1,
            stages: m.steps.length,
            timer: this.timer > 0 ? this.timer : 0,
            next: after ? after.text : 'Payday · ' + formatMoney(Math.round(m.reward * this.G.rep.bonus())),
        };
    }

    target() {
        if (this.race) return SIDE.race.cps[this.race.cp];
        if (!this.active) {
            const m = this.current();
            return m ? PLACES[m.giver] : null;
        }
        const s = this.active.steps[this.step];
        if (!s) return null;
        if (s.t === 'race') return s.cps[this.cp];
        if (s.t === 'kill') {
            const alive = this.spawned.find((p) => !p.dead && p.role !== 'npc');
            return alive ? [alive.x, alive.z] : s.pos;
        }
        if (s.t === 'deliver' && this.vehicle && this.G.player.vehicle !== this.vehicle) return [this.vehicle.x, this.vehicle.z];
        if (s.t === 'companion' && this.companion) return [this.companion.x, this.companion.z];
        return this.stepPos(s);
    }

    update(dt) {
        const G = this.G,
            P = G.player;
        this.t += dt;
        const near = (p, r = 5) => p && Math.hypot(p[0] - P.x, p[1] - P.z) < r;
        this.updateCollectibles(dt);
        if (this.race) return this.updateRace(dt);
        if (!this.active) {
            const m = this.current();
            this.cooldown = Math.max(0, (this.cooldown || 0) - dt);
            if (m) {
                const p = PLACES[m.giver];
                this.giverBeam.show(p[0], p[1], this.t);
                if (near(p, 4.5) && Math.abs(P.speed) < 9 && !G.wanted.level && !this.cooldown) {
                    this.giverBeam.hide();
                    this.start(this.progress);
                }
            } else this.giverBeam.hide();
            this.sideBeam.show(SIDE.race.start[0], SIDE.race.start[1], this.t);
            if (near(SIDE.race.start, 4.5) && P.vehicle && !G.wanted.level) this.startRace();
            this.goalBeam.hide();
            this.cpBeam.hide();
            return;
        }
        this.giverBeam.hide();
        this.sideBeam.hide();
        const s = this.active.steps[this.step];
        if (this.timer > 0) {
            this.timer -= dt;
            if (this.timer <= 0) return this.fail('Out of time');
        }
        if (this.vehicle && this.vehicle.dead) return this.fail('The car was wrecked');
        if (this.companion && this.companion.dead) return this.fail('Aurora is dead');
        const tgt = this.target();
        if (tgt && s.t !== 'kill' && s.t !== 'escape')(s.t === 'race' ? this.cpBeam : this.goalBeam).show(tgt[0], tgt[1], this.t);
        else this.goalBeam.hide();
        if (s.t !== 'race') this.cpBeam.hide();
        let done = false;
        switch (s.t) {
            case 'car':
                done = !!P.vehicle;
                break;
            case 'goto':
                done = near(this.stepPos(s), 6) && (!s.needCar || P.vehicle) && (!s.wanted || true);
                break;
            case 'steal':
                done = P.vehicle === this.vehicle;
                break;
            case 'deliver':
                done = P.vehicle === this.vehicle && near(this.stepPos(s), 7);
                break;
            case 'kill':
                done = this.spawned.filter((p) => p.role === 'gang').every((p) => p.dead);
                break;
            case 'pickup':
                done = near(s.pos, 2.6);
                if (done) {
                    G.audio ? .pickup();
                    G.hud.toast('Got it!', 'good');
                }
                break;
            case 'escape':
                done = G.wanted.level === 0;
                break;
            case 'companion':
                {
                    const c = this.companion;c.follow = true;
                    if (P.vehicle && Math.hypot(c.x - P.x, c.z - P.z) < 6) {
                        c.rig.root.visible = false;
                        c.inCar = true;
                        done = true;
                    }
                    break;
                }
            case 'race':
                if (near(s.cps[this.cp], 9)) {
                    G.audio ? .pickup();
                    this.cp++;
                    if (this.cp >= s.cps.length) done = true;
                }
                break;
        }
        if (this.companion ? .inCar) {
            this.companion.x = P.x;
            this.companion.z = P.z;
            if (!P.vehicle) {
                this.companion.inCar = false;
                this.companion.rig.root.visible = true;
            }
        }
        if (done) {
            if (s.say)
                for (const [w, l] of s.say) G.hud.say(CAST[w].short, l, CAST[w].color);
            this.next();
        }
    }

    pass() {
        const G = this.G,
            m = this.active;
        const pay = Math.round(m.reward * G.rep.bonus()),
            respect = 40 + Math.round(m.reward / 100);
        G.economy.earn(pay);
        G.stats.missions++;
        G.hud.missionBanner('MISSION PASSED', '+' + formatMoney(pay) + '  ·  RESPECT +' + respect, 'pass');
        G.rep.earn(respect);
        G.audio ? .sting('pass');
        if (m.unlock) G.economy.unlock(m.unlock);
        if (m.final) G.hud.say('Nico', 'Six years for nothing. One golden hour for everything.', CAST.nico.color);
        this.cleanup(false);
        this.active = null;
        this.progress++;
        this.cooldown = 6;
        G.save.autosave();
    }

    fail(why) {
        const G = this.G;
        G.hud.missionBanner('MISSION FAILED', why, 'fail');
        G.audio ? .sting('fail');
        this.cleanup(true);
        this.active = null;
        this.cooldown = 6;
    }

    cleanup(all) {
        const G = this.G;
        for (const e of this.spawned) {
            if (e.rig && (all || e.role === 'npc')) {
                e.dispose();
                const i = G.peds.indexOf(e);
                if (i >= 0) G.peds.splice(i, 1);
            }
            if (e.spec && all && G.player.vehicle !== e) {
                e.dispose();
                const i = G.vehicles.indexOf(e);
                if (i >= 0) G.vehicles.splice(i, 1);
            }
            if (e.spec && !all) e.role = 'stolen';
        }
        this.spawned = [];
        this.vehicle = null;
        this.companion = null;
        this.goalBeam.hide();
        this.cpBeam.hide();
    }

    onPlayerDown() {
        if (this.active) this.fail('You went down');
        if (this.race) {
            this.race = null;
            this.cpBeam.hide();
        }
    }

    startRace() {
        this.race = {
            cp: 0,
            time: SIDE.race.time
        };
        this.G.hud.missionBanner(SIDE.race.title.toUpperCase(), 'Hit every checkpoint', 'start');
        this.sideBeam.hide();
    }
    updateRace(dt) {
        const G = this.G,
            P = G.player,
            r = this.race,
            cp = SIDE.race.cps[r.cp];
        r.time -= dt;
        this.cpBeam.show(cp[0], cp[1], this.t);
        if (Math.hypot(cp[0] - P.x, cp[1] - P.z) < 9) {
            r.cp++;
            G.audio ? .pickup();
        }
        if (r.cp >= SIDE.race.cps.length) {
            G.economy.earn(SIDE.race.reward);
            G.hud.missionBanner('RACE WON', '+' + formatMoney(SIDE.race.reward), 'pass');
            this.race = null;
            this.cpBeam.hide();
            G.stats.races++;
            G.rep.earn(60, 'Race won');
        } else if (r.time <= 0 || !P.vehicle) {
            G.hud.missionBanner('RACE LOST', r.time <= 0 ? 'Too slow' : 'You left the car', 'fail');
            this.race = null;
            this.cpBeam.hide();
        }
    }

    updateCollectibles() {
        const G = this.G,
            P = G.player;
        SIDE.shells.forEach(([x, z], i) => {
            const s = this.shellSprites[i];
            s.visible = !this.shells.has(i);
            if (!s.visible) return;
            s.position.y = 1.2 + Math.sin(this.t * 3 + i) * 0.25;
            if (Math.hypot(x - P.x, z - P.z) < 2.5) {
                this.shells.add(i);
                G.economy.earn(250);
                G.audio ? .pickup();
                G.rep.earn(10);
                G.hud.toast('Golden Conch ' + this.shells.size + '/10', 'good');
                if (this.shells.size === 10) {
                    G.combat.give('rifle', 200);
                    G.hud.toast('All conches! Kestrel AR unlocked', 'good');
                }
            }
        });
    }

    blips() {
        const out = [];
        if (!this.active && this.current()) {
            const m = this.current(),
                p = PLACES[m.giver];
            out.push({
                x: p[0],
                z: p[1],
                color: CAST[m.giver].color,
                label: CAST[m.giver].short[0]
            });
        }
        if (!this.active && !this.race) out.push({
            x: SIDE.race.start[0],
            z: SIDE.race.start[1],
            color: '#55d6ff',
            label: 'R'
        });
        const t = this.target();
        if (t && (this.active || this.race)) out.push({
            x: t[0],
            z: t[1],
            color: '#ffd84a',
            label: '',
            goal: true
        });
        if (this.active)
            for (const p of this.spawned)
                if (p.role === 'gang' && !p.dead) out.push({
                    x: p.x,
                    z: p.z,
                    color: '#ff4040',
                    label: '',
                    small: true
                });
        return out;
    }
}