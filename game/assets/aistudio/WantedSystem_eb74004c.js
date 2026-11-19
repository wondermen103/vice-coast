// WantedSystem: witnessed crimes add heat (1-5 stars); out of police sight an evasion timer clears it.
import {
    formatMoney
} from '../core/MathUtil.js';

const THRESH = [0, 20, 80, 180, 320, 520];
const HEAT = {
    theft: 20,
    carjack: 25,
    stealCop: 70,
    gunfire: 14,
    assault: 30,
    killCiv: 45,
    killCop: 110,
    hitCop: 35,
    explosion: 40,
    ram: 12,
    heist: 600
};

export class WantedSystem {
    constructor(G) {
        this.G = G;
        this.heat = 0;
        this.level = 0;
        this.unseen = 0;
        this.seen = false;
        this.lastSeen = [0, 0];
        G.events.on('pedKilled', ({
            ped,
            byPlayer
        }) => {
            if (!byPlayer) return;
            this.crime(ped.role === 'cop' ? 'killCop' : ped.role === 'civ' ? 'killCiv' : 'gunfire', ped.x, ped.z);
            G.stats.kills++;
        });
        G.events.on('carCrash', ({
            a,
            b,
            rel
        }) => {
            const P = G.player.vehicle;
            if (P && (a === P || b === P) && (a.role === 'police' || b.role === 'police') && rel > 5) this.crime('ram', P.x, P.z);
        });
        G.events.on('explosion', ({
            x,
            z
        }) => {
            if (Math.hypot(x - G.player.x, z - G.player.z) < 60) this.crime('explosion', x, z);
        });
    }

    witnessed(x, z) {
        const G = this.G;
        if (G.police.units.some((u) => Math.hypot(u.x - x, u.z - z) < 90)) return true;
        return G.peds.some((p) => !p.dead && (p.role === 'civ' || p.role === 'cop') && Math.hypot(p.x - x, p.z - z) < 35);
    }

    crime(type, x, z) {
        const add = HEAT[type] || 10;
        if (!this.witnessed(x, z) && type !== 'killCop' && type !== 'stealCop' && type !== 'heist') return;
        const before = this.level;
        this.heat = Math.min(THRESH[5] + 200, this.heat + add);
        while (this.level < 5 && this.heat >= THRESH[this.level + 1]) this.level++;
        this.unseen = 0;
        this.lastSeen = [x, z];
        this.G.peds && this.G.pedSystem.panic(x, z, 30);
        if (this.level > before) {
            this.G.hud ? .wantedUp(this.level);
            this.G.audio ? .wantedSting();
        }
    }

    setLevel(n) {
        this.level = n;
        this.heat = THRESH[n] + 5;
        this.unseen = 0;
        if (n) this.G.hud ? .wantedUp(n);
    }
    clear() {
        this.level = 0;
        this.heat = 0;
        this.unseen = 0;
    }
    evadeTime() {
        return 7 + this.level * 2.6;
    }

    update(dt) {
        if (!this.level) return;
        const G = this.G,
            P = G.player;
        this.seen = G.police.canSee(P.x, P.z);
        if (this.seen) {
            this.unseen = 0;
            this.lastSeen = [P.x, P.z];
        } else {
            this.unseen += dt;
            if (this.unseen > this.evadeTime()) {
                const lvl = this.level;
                this.clear();
                G.hud ? .toast('Lost the PCPD (' + lvl + '★) · +' + formatMoney(lvl * 150), 'good');
                G.economy.earn(lvl * 150);
                G.stats.escapes++;
                G.events.emit('wantedCleared', lvl);
            }
        }
    }
    evadeProgress() {
        return this.level ? Math.min(1, this.unseen / this.evadeTime()) : 0;
    }
}