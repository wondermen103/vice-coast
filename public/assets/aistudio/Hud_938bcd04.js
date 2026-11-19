// Hud: mission card with stages, PCPD dispatch board, money, wanted stars, weapon slots, respect, vehicle card, dialogue with portraits.
import {
    DISTRICTS,
    districtAt,
    streetAt
} from '../world/CityLayout.js';
import {
    formatMoney
} from '../core/MathUtil.js';
import {
    WEAPONS
} from '../combat/Weapons.js';
import {
    portrait,
    roleOf
} from './Portraits.js';

const $ = (id) => document.getElementById(id);
const STATE_CLASS = {
    RAMMING: 'hot',
    FIRING: 'hot',
    PURSUIT: 'chase',
    SPOTLIGHT: 'air',
    SWEEPING: 'air',
    ROADBLOCK: 'block',
    'ON FOOT': 'chase',
    SEARCHING: 'calm',
    PATROL: 'calm',
    WRECKED: 'dead'
};
const ICON = {
    car: '▬',
    van: '■',
    heli: '✚'
};
const clock = (t) => Math.floor(t / 60) + ':' + String(Math.floor(t % 60)).padStart(2, '0');
const set = (el, html) => {
    if (el.dataset.v !== html) {
        el.innerHTML = html;
        el.dataset.v = html;
    }
};

export class Hud {
    constructor(G) {
        this.G = G;
        this.lines = [];
        this.lineT = 0;
        this.shownMoney = 0;
        this.hintText = '';
        this.hintT = 0;
        this.place = '';
        this.boardT = 0;
        this.el = {};
        for (const id of ['hud', 'mission-card', 'mission-job', 'mission-tag', 'mission-timer', 'mission-obj', 'mission-sub', 'mission-stage', 'stage-label', 'stage-bar', 'mission-next',
                'dispatch', 'dispatch-count', 'dispatch-rows', 'dispatch-foot', 'clock', 'money', 'stars', 'search', 'weapons', 'wanted-banner', 'hp', 'ar', 'district', 'street',
                'rep-level', 'rep-title', 'rep-bar', 'rep-pts', 'vehicle-info', 'radio', 'speed', 'gear', 'car-name', 'car-cond', 'car-cond-pct', 'dialogue', 'toasts', 'help', 'crosshair', 'fade'
            ]) this.el[id] = $(id);
    }

    show(on) {
        this.el.hud.classList.toggle('hidden', !on);
    }
    say(who, text, color = '#ffd166', dur) {
        this.lines.push({
            who,
            text,
            color,
            dur: dur || Math.max(3.2, text.length * 0.065)
        });
    }
    hint(t) {
        this.hintText = t;
        this.hintT = 0.2;
    }

    toast(text, kind = '', ms = 3200) {
        const d = document.createElement('div');
        d.className = 'toast ' + kind;
        d.textContent = text;
        this.el.toasts.appendChild(d);
        setTimeout(() => d.remove(), ms);
        while (this.el.toasts.children.length > 4) this.el.toasts.firstChild.remove();
    }
    moneyPop(n) {
        if (n > 0) this.toast('+' + formatMoney(n), 'cash');
    }
    flashDamage() {
        this.el.hud.classList.remove('hurt');
        void this.el.hud.offsetWidth;
        this.el.hud.classList.add('hurt');
    }

    missionBanner(title, sub, kind) {
        const b = document.createElement('div');
        b.className = 'banner ' + kind;
        b.innerHTML = `<b>${title}</b><span>${sub}</span>`;
        document.body.appendChild(b);
        setTimeout(() => b.remove(), 4200);
    }

    wantedUp(level) {
        const w = this.el['wanted-banner'];
        w.textContent = 'WANTED ' + '★'.repeat(level);
        w.classList.remove('hidden', 'pulse');
        void w.offsetWidth;
        w.classList.add('pulse');
        clearTimeout(this.wt);
        this.wt = setTimeout(() => w.classList.add('hidden'), 2600);
    }

    // mission card: job number, title, countdown, objective, live sub-line, stage bar and what comes next
    mission(o) {
        const e = this.el;
        e['mission-card'].classList.toggle('hidden', !o);
        if (!o) return;
        e['mission-job'].textContent = o.job || '';
        e['mission-job'].style.display = o.job ? '' : 'none';
        e['mission-tag'].textContent = o.job ? o.tag + ' · ' + o.giver : o.tag;
        e['mission-timer'].textContent = o.timer ? '⏱ ' + clock(o.timer) : '';
        e['mission-timer'].style.display = o.timer ? '' : 'none';
        e['mission-timer'].classList.toggle('low', o.timer > 0 && o.timer < 30);
        e['mission-obj'].textContent = o.text;
        e['mission-sub'].textContent = o.sub;
        e['mission-sub'].style.display = o.sub ? '' : 'none';
        e['mission-stage'].style.display = o.stages ? '' : 'none';
        if (o.stages) {
            e['stage-label'].textContent = 'STAGE ' + o.stage + '/' + o.stages;
            set(e['stage-bar'], Array.from({
                length: o.stages
            }, (_, i) => `<i class="${i < o.stage - 1 ? 'done' : i === o.stage - 1 ? 'now' : ''}"></i>`).join(''));
        }
        e['mission-next'].innerHTML = o.next ? '<b>NEXT</b> ' + o.next : '';
        e['mission-next'].style.display = o.next ? '' : 'none';
    }

    // the PCPD dispatch board, straight from PoliceDispatch.roster(): callsign, range, what each unit is doing
    dispatch() {
        const G = this.G,
            e = this.el,
            lvl = G.wanted.level,
            rows = lvl ? G.police.roster() : [];
        e.dispatch.classList.toggle('hidden', !rows.length);
        if (!rows.length) return;
        const ground = rows.filter((r) => r.kind !== 'heli' && r.state !== 'WRECKED').length;
        e['dispatch-count'].textContent = ground + (G.police.heli.active ? 1 : 0) + ' UNITS · CODE ' + lvl;
        set(e['dispatch-rows'], rows.slice(0, 5).map((r) => `<div class="du ${STATE_CLASS[r.state]}"><u>${ICON[r.kind]}</u><b>${r.sign}</b><span>${Math.round(r.d)} m</span><em>${r.state}</em></div>`).join(''));
        const more = rows.length - 5,
            wrecked = rows.filter((r) => r.state === 'WRECKED').length;
        e['dispatch-foot'].textContent = (more > 0 ? '+' + more + ' more units · ' : '') + (wrecked ? wrecked + ' wrecked · ' : '') + (lvl >= 4 ? 'roadblocks on the boulevard' : lvl >= 3 ? 'Air-1 overhead' : 'search grid active');
    }

    // five numbered slots: owned guns with ammo, the selected one lit, unbought ones priced, story-locked ones LOCKED
    weapons() {
        const C = this.G.combat,
            Ec = this.G.economy;
        const html = WEAPONS.map((w, i) => {
            const own = C.owned[w.id],
                sel = i === C.index;
            const foot = !own ? (Ec.unlocked.has(w.id) ? formatMoney(w.price) : 'LOCKED') : w.id === 'fists' ? '∞' : (C.ammo[w.id] || 0);
            return `<div class="ws ${sel ? 'sel' : ''} ${own ? '' : Ec.unlocked.has(w.id) ? 'shop' : 'lock'}"><sup>${i + 1}</sup><b>${w.name.split(' ')[0].toUpperCase()}</b><small>${foot}</small></div>`;
        }).join('');
        set(this.el.weapons, html + `<div class="wn">${C.current().name.toUpperCase()}</div>`);
    }

    update(dt) {
        const G = this.G,
            P = G.player,
            e = this.el;
        this.mission(G.missions.objective());
        e.clock.textContent = G.sky.clockText();
        this.shownMoney += (G.economy.money - this.shownMoney) * Math.min(1, dt * 6);
        if (Math.abs(G.economy.money - this.shownMoney) < 1) this.shownMoney = G.economy.money;
        e.money.textContent = formatMoney(this.shownMoney);
        const lvl = G.wanted.level,
            blink = lvl && !G.wanted.seen && Math.sin(performance.now() / 160) > 0;
        let s = '';
        for (let i = 1; i <= 5; i++) s += `<i class="${i <= lvl ? (blink ? 'on blink' : 'on') : ''}">★</i>`;
        set(e.stars, s);
        e.stars.classList.toggle('hot', lvl > 0);
        set(e.search, lvl ? (G.wanted.seen ? '<b class="seen">IN SIGHT</b> search zone follows you' : '<b>HIDDEN</b> evading ' + Math.round(G.wanted.evadeProgress() * 100) + '%') : '');
        if ((this.boardT -= dt) <= 0) {
            this.boardT = 0.25;
            this.dispatch();
            this.weapons();
        }
        e.hp.style.width = Math.max(0, P.health) + '%';
        e.ar.style.width = P.armor + '%';
        // respect: level badge, title, progress through the level
        const R = G.rep,
            [into, span] = R.span();
        e['rep-level'].textContent = R.level;
        e['rep-title'].textContent = 'RESPECT · ' + R.title().toUpperCase();
        e['rep-bar'].style.width = Math.round(100 * into / span) + '%';
        e['rep-pts'].textContent = into + ' / ' + span;
        const dk = districtAt(P.x, P.z),
            d = DISTRICTS[dk];
        if (this.place !== dk) {
            this.place = dk;
            e.district.textContent = d.name;
            e.district.style.color = d.color;
        }
        e.street.textContent = streetAt(P.x, P.z);
        const v = P.vehicle,
            shop = !!G.economy.open; // a shop menu takes the right side: the weapon slots and car card step aside
        e['vehicle-info'].classList.toggle('hidden', !v || shop);
        e.weapons.classList.toggle('hidden', shop);
        if (v) {
            const kmh = Math.abs(v.speed) * 3.6,
                top = v.spec.top * (1 + v.upgrade * 0.12),
                cond = Math.max(0, Math.round(100 * v.health / v.maxHealth));
            e.speed.innerHTML = Math.round(kmh) + '<small>km/h</small>';
            e.gear.textContent = v.speed < -0.5 ? 'R' : 'G' + Math.min(5, 1 + Math.floor(Math.abs(v.speed) / top * 5));
            e['car-name'].textContent = v.spec.name.toUpperCase() + (v.upgrade ? '  ·  TUNE ' + v.upgrade : '');
            e['car-cond'].style.width = cond + '%';
            e['car-cond'].className = cond < 35 ? 'bad' : cond < 65 ? 'mid' : '';
            e['car-cond-pct'].textContent = cond + '%';
            set(e.radio, G.radio ? G.radio.label() : '');
        }
        // dialogue queue: speaker portrait, name and role, line
        if (this.lines.length) {
            const l = this.lines[0];
            if (this.lineT === 0) {
                const face = portrait(l.who);
                e.dialogue.innerHTML = (face ? `<img src="${face}" alt="">` : '') + `<div><b style="color:${l.color}">${l.who}</b><small>${roleOf(l.who)}</small><p>${l.text}</p></div>`;
                e.dialogue.classList.toggle('face', !!face);
                e.dialogue.style.borderColor = l.color;
                e.dialogue.classList.remove('hidden');
            }
            this.lineT += dt;
            if (this.lineT > l.dur) {
                this.lines.shift();
                this.lineT = 0;
                if (!this.lines.length) e.dialogue.classList.add('hidden');
            }
        }
        this.hintT -= dt;
        const veh = !v && G.carjack.nearest(4.5),
            w = G.combat.current();
        const help = this.hintT > 0 ? this.hintText : veh ? 'Press F · ' + (veh.driver ? 'Carjack ' : 'Steal ') + veh.spec.name : '';
        if (e.help.textContent !== help) e.help.textContent = help;
        e.crosshair.classList.toggle('hidden', !(G.input.mouse.right || G.input.mouse.left) || !!v || w.id === 'fists');
    }
}