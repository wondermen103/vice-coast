// Menus: title screen, pause map with story and stats, save/load, shop panels, WASTED / BUSTED.
import {
    STORY,
    CAST,
    PLACES
} from '../missions/StoryMissions.js';
import {
    formatMoney
} from '../core/MathUtil.js';

const $ = (id) => document.getElementById(id);
const LOGO = '<div class="logo"><span class="l1">GOLDEN HOUR</span><span class="l2">KINGS</span><span class="l3">PUERTO CELESTE</span></div>';
const CONTROLS = 'WASD move / drive · Mouse look · Shift sprint · Space handbrake · F enter / carjack · LMB shoot · RMB aim · Q/E or wheel weapons · R radio · H horn · E shops · M / P / Esc map';

export class Menus {
    constructor(G) {
        this.G = G;
    }

    title(hasSave) {
        const t = $('title');
        t.innerHTML = `${LOGO}<div class="tag">A story of debts, neon and the last light over the Malecón.</div>
      <div class="buttons"><button id="b-new">NEW GAME</button>${hasSave ? '<button id="b-cont">CONTINUE</button>' : ''}<button id="b-ctl">CONTROLS</button></div>
      <div class="controls hidden" id="ctl">${CONTROLS}</div><div class="foot">An original open-world crime game · all names, places and music invented</div>`;
        t.classList.remove('hidden');
        $('b-new').onclick = () => this.G.newGame();
        if (hasSave) $('b-cont').onclick = () => this.G.continueGame();
        $('b-ctl').onclick = () => $('ctl').classList.toggle('hidden');
    }
    hideTitle() {
        $('title').classList.add('hidden');
    }

    pause(on) {
        const p = $('pause'),
            G = this.G;
        p.classList.toggle('hidden', !on);
        if (!on) return;
        const story = STORY.map((m, i) => `<li class="${i < G.missions.progress ? 'done' : i === G.missions.progress ? 'now' : ''}"><b>${i + 1}</b> ${m.title}<small>${CAST[m.giver].short}</small></li>`).join('');
        const s = G.stats;
        p.innerHTML = `<div class="pause-left">${LOGO}<div class="menu"><button id="p-resume">RESUME</button><button id="p-save">SAVE GAME</button><button id="p-load">LOAD GAME</button><button id="p-quit">QUIT TO TITLE</button></div>
      <div class="stats"><div><span>Cash</span><b>${formatMoney(G.economy.money)}</b></div><div><span>Story</span><b>${G.missions.progress}/${STORY.length}</b></div><div><span>Golden Conches</span><b>${G.missions.shells.size}/10</b></div><div><span>Respect · ${G.rep.title()}</span><b>LV ${G.rep.level}</b></div>
      <div><span>Escapes</span><b>${s.escapes}</b></div><div><span>Takedowns</span><b>${s.kills}</b></div><div><span>Races won</span><b>${s.races}</b></div></div></div>
      <div class="pause-map"><canvas id="bigmap" width="760" height="760"></canvas><div class="legend"><i style="background:#ffd84a"></i>Objective <i style="background:#ff7a59"></i>Tidewater Arms <i style="background:#48e39a"></i>Sully's <i style="background:#fff"></i>Safehouse <i style="background:#55d6ff"></i>Race <i style="background:#ff3344"></i>PCPD</div></div>
      <div class="pause-right"><h3>STORY</h3><ol class="story">${story}</ol><h3>NOW</h3><p class="now-obj">${G.missions.objective().text}</p><p class="where">${PLACES.safehouse[2]} · safehouse saves &amp; heals</p></div>`;
        G.minimap.drawFull($('bigmap'));
        $('p-resume').onclick = () => G.setPaused(false);
        $('p-save').onclick = () => G.save.save();
        $('p-load').onclick = () => {
            if (G.save.load()) {
                G.setPaused(false);
                G.hud.toast('Loaded', 'good');
            }
        };
        $('p-quit').onclick = () => location.reload();
    }

    // card (garage only): { name, stats: [[label, value 0..1, preview 0..1]] } drawn as bars above the price list
    shop(title, items, card) {
        const s = $('shop'),
            cash = this.G.economy.money;
        const bars = card ? `<div class="car-card"><div class="car-name">${card.name}</div>${card.stats.map(([l, v, p]) => `<div class="stat"><span>${l}</span><div class="bar"><i class="next" style="width:${Math.round(p * 100)}%"></i><i style="width:${Math.round(v * 100)}%"></i></div></div>`).join('')}</div>` : '';
        const pips = (t) => t ? `<em class="pips">${[0, 1, 2].map((n) => `<u class="${n < t[0] ? 'on' : ''}"></u>`).join('')}</em>` : '';
        s.classList.toggle('garage', !!card);
        s.innerHTML = `<h2>${title}</h2>${bars}<ul>${items.map((it, i) => `<li data-i="${i}" class="${it.price > cash ? 'dear' : ''}"><b>${i + 1}</b>${it.label}${pips(it.tier)}<span>${it.price ? formatMoney(it.price) : ''}</span></li>`).join('')}</ul><p>Number keys or click to buy · Esc to leave · Cash <strong>${formatMoney(cash)}</strong></p>`;
        s.classList.remove('hidden');
        s.querySelectorAll('li').forEach((li) => {
            li.onclick = () => this.G.economy.buy(+li.dataset.i);
        });
    }
    closeShop() {
        $('shop').classList.add('hidden');
    }

    down(cause) {
        const f = $('fade');
        f.className = 'down ' + cause;
        f.innerHTML = `<b>${cause === 'busted' ? 'BUSTED' : 'WASTED'}</b><span>${cause === 'busted' ? 'PCPD Central keeps 10% of your cash' : 'Mercy Clinic patched you up · -$500'}</span>`;
        setTimeout(() => {
            f.className = 'hidden';
        }, 3600);
    }
}