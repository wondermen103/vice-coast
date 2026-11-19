// RadioSynth: three original stations sequenced live (synthwave, dembow, lo-fi); R changes station.
const STATIONS = [{
        name: 'CELESTE 98.1',
        genre: 'Sunset Synthwave',
        bpm: 100,
        chords: [
            [57, 60, 64],
            [53, 57, 60],
            [48, 52, 55],
            [55, 59, 62]
        ],
        kick: [0, 4, 8, 12],
        snare: [4, 12],
        hat: 'eighths',
        lead: 'arp',
        songs: ['Neon Tide · Los Faroles', 'Malecón Mirage · Vela Roja', 'Last Light Drive · Cometa']
    },
    {
        name: 'OLA 104.5',
        genre: 'Dembow Playa',
        bpm: 98,
        chords: [
            [50, 53, 57],
            [46, 50, 53],
            [48, 52, 55],
            [45, 48, 52]
        ],
        kick: [0, 4, 8, 12],
        snare: [3, 6, 11, 14],
        hat: 'sixteenths',
        lead: 'pluck',
        songs: ['Arena Caliente · DJ Marea', 'Perreo en el Muelle · La Brisa', 'Tiburón · Kilo Sur']
    },
    {
        name: 'PUERTO 88.3',
        genre: 'Lo-Fi Harbour',
        bpm: 76,
        chords: [
            [50, 53, 57, 60, 64],
            [43, 47, 50, 53, 57],
            [48, 52, 55, 59, 62],
            [45, 49, 52, 55, 59]
        ],
        kick: [0, 10],
        snare: [4, 12],
        hat: 'swing',
        lead: 'keys',
        songs: ['Fog over Dock 9 · Pelícano', 'Night Ferry · Ana Luz', 'Saltwater Tape · Muelle Boys']
    },
];
const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);

export class RadioSynth {
    constructor(audio) {
        this.audio = audio;
        this.station = 0;
        this.on = false;
        this.step = 0;
        this.nextT = 0;
        this.song = 0;
    }

    label() {
        const s = STATIONS[this.station];
        return `♪ ${s.name}<small>${s.songs[this.song % 3]}</small>`;
    }
    carEntered(v) {
        this.on = true;
        if (v) this.station = v.id % STATIONS.length;
        this.retime();
    }
    carLeft() {
        this.on = false;
    }
    next() {
        this.station = (this.station + 1) % STATIONS.length;
        this.song = 0;
        this.retime();
        this.audio.click();
    }
    retime() {
        if (this.audio.ctx) this.nextT = this.audio.ctx.currentTime + 0.05;
    }

    note(f, t, dur, vol, type, cutoff = 2000) {
        const c = this.audio.ctx,
            o = c.createOscillator(),
            g = c.createGain(),
            fl = c.createBiquadFilter();
        o.type = type;
        o.frequency.value = f;
        fl.type = 'lowpass';
        fl.frequency.value = cutoff;
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        o.connect(fl).connect(g).connect(this.audio.music);
        o.start(t);
        o.stop(t + dur + 0.05);
    }
    drum(kind, t) {
        const c = this.audio.ctx;
        if (kind === 'kick') {
            const o = c.createOscillator(),
                g = c.createGain();
            o.frequency.setValueAtTime(140, t);
            o.frequency.exponentialRampToValueAtTime(42, t + 0.14);
            g.gain.setValueAtTime(0.7, t);
            g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
            o.connect(g).connect(this.audio.music);
            o.start(t);
            o.stop(t + 0.35);
            return;
        }
        const s = this.audio.noise(),
            f = c.createBiquadFilter(),
            g = c.createGain();
        f.type = kind === 'hat' ? 'highpass' : 'bandpass';
        f.frequency.value = kind === 'hat' ? 7000 : 1800;
        const dur = kind === 'hat' ? 0.04 : 0.16;
        g.gain.setValueAtTime(kind === 'hat' ? 0.12 : 0.35, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + dur);
        s.connect(f).connect(g).connect(this.audio.music);
        s.start(t, Math.random());
        s.stop(t + dur + 0.02);
    }

    update() {
        const A = this.audio;
        if (!A.ctx) return;
        A.music.gain.setTargetAtTime(this.on ? 0.5 : 0, A.ctx.currentTime, 0.3);
        if (!this.on) return;
        const S = STATIONS[this.station],
            sixteenth = 60 / S.bpm / 4;
        if (this.nextT < A.ctx.currentTime) this.nextT = A.ctx.currentTime + 0.05;
        while (this.nextT < A.ctx.currentTime + 0.15) {
            const t = this.nextT,
                st = this.step % 16,
                ch = S.chords[Math.floor(this.step / 16) % 4];
            if (S.kick.includes(st)) this.drum('kick', t);
            if (S.snare.includes(st)) this.drum('snare', t);
            if (S.hat === 'sixteenths' || (S.hat === 'eighths' && st % 2 === 0) || (S.hat === 'swing' && st % 4 === 2)) this.drum('hat', t);
            if (st % 4 === 0) this.note(hz(ch[0] - 24), t, sixteenth * 3.5, 0.22, 'sawtooth', 380);
            if (st === 0)
                for (const m of ch) this.note(hz(m), t, sixteenth * 15, S.lead === 'keys' ? 0.05 : 0.04, S.lead === 'keys' ? 'triangle' : 'sawtooth', 1200);
            if (S.lead === 'arp') this.note(hz(ch[st % ch.length] + 12), t, sixteenth * 0.9, 0.05, 'square', 2600);
            if (S.lead === 'pluck' && [0, 3, 6, 10, 13].includes(st)) this.note(hz(ch[(st * 7) % ch.length] + 12), t, sixteenth * 1.5, 0.08, 'triangle', 3000);
            if (S.lead === 'keys' && (st === 6 || st === 14)) this.note(hz(ch[(this.step >> 4) % ch.length] + 12), t, sixteenth * 6, 0.06, 'sine');
            this.nextT += sixteenth * (S.hat === 'swing' && st % 2 === 0 ? 1.15 : S.hat === 'swing' ? 0.85 : 1);
            this.step++;
            if (this.step % 256 === 0) this.song++;
        }
    }
}