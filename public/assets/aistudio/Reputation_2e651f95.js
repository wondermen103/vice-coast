// Reputation: street respect earned by missions, races, escapes, gang kills and conches; each level raises mission pay.
const LEVELS = [0, 120, 300, 560, 900, 1350, 1900, 2600, 3500];
const TITLES = ['Nobody', 'Street Rat', 'Hustler', 'Wheelman', 'Enforcer', 'Shot Caller', 'Lieutenant', 'Underboss', 'King of the Hour'];

export class Reputation {
    constructor(G) {
        this.G = G;
        this.points = 0;
        G.events.on('pedKilled', ({
            ped,
            byPlayer
        }) => {
            if (byPlayer && ped.role === 'gang') this.earn(6);
        });
        G.events.on('wantedCleared', (lvl) => this.earn(20 * lvl, 'Escape'));
    }

    get level() {
        let l = 0;
        while (l < LEVELS.length - 1 && this.points >= LEVELS[l + 1]) l++;
        return l + 1;
    }
    title() {
        return TITLES[this.level - 1];
    }
    // progress inside the current level: [points into it, points it spans]
    span() {
        const i = this.level - 1,
            lo = LEVELS[i],
            hi = LEVELS[i + 1] ? ? lo + 1000;
        return [this.points - lo, hi - lo];
    }
    bonus() {
        return 1 + (this.level - 1) * 0.05;
    } // +5% mission pay per level above the first

    earn(n, why) {
        const before = this.level;
        this.points += n;
        if (why) this.G.hud ? .toast('RESPECT +' + n + ' · ' + why, 'rep');
        if (this.level > before) {
            this.G.hud ? .missionBanner('RESPECT LEVEL ' + this.level, this.title().toUpperCase() + '  ·  MISSION PAY +' + Math.round((this.bonus() - 1) * 100) + '%', 'pass');
            this.G.audio ? .sting('pass');
        }
    }
}