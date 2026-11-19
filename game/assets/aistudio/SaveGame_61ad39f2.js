// SaveGame: localStorage slot for progress, money, weapons, unlocks, stats; autosave after missions.
const KEY = 'golden-hour-kings/save-v1';

export class SaveGame {
    constructor(G) {
        this.G = G;
    }

    snapshot() {
        const G = this.G;
        return {
            v: 1,
            progress: G.missions.progress,
            money: G.economy.money,
            unlocked: [...G.economy.unlocked],
            owned: G.combat.owned,
            ammo: G.combat.ammo,
            armor: G.player.armor,
            shells: [...G.missions.shells],
            stats: G.stats,
            hour: G.sky.hour,
            pos: [G.player.x, G.player.z],
            respect: G.rep.points,
        };
    }

    save() {
        try {
            localStorage.setItem(KEY, JSON.stringify(this.snapshot()));
            this.G.hud ? .toast('Game saved', 'good');
            return true;
        } catch {
            this.G.hud ? .toast('Could not save (storage blocked)', 'bad');
            return false;
        }
    }
    autosave() {
        try {
            localStorage.setItem(KEY, JSON.stringify(this.snapshot()));
        } catch { /* storage unavailable */ }
    }

    exists() {
        try {
            return !!localStorage.getItem(KEY);
        } catch {
            return false;
        }
    }

    load() {
        let d;
        try {
            d = JSON.parse(localStorage.getItem(KEY) || 'null');
        } catch {
            d = null;
        }
        if (!d || d.v !== 1) return false;
        const G = this.G;
        G.missions.progress = d.progress;
        G.economy.money = d.money;
        G.economy.unlocked = new Set(d.unlocked);
        G.combat.owned = d.owned;
        G.combat.ammo = d.ammo;
        G.player.armor = d.armor;
        G.missions.shells = new Set(d.shells);
        G.rep.points = d.respect || 0;
        Object.assign(G.stats, d.stats);
        G.sky.hour = d.hour;
        G.player.place(d.pos[0], d.pos[1], 0);
        return true;
    }
}