// AudioEngine: synthesised WebAudio effects: guns, explosions, crashes, engine, siren, rotor, stings.
export class AudioEngine {
    constructor() {
        this.ctx = null;
    }

    // Created (or resumed) only inside a real user gesture, as browsers require.
    start() {
        if (navigator.userActivation && !navigator.userActivation.isActive) return;
        if (this.ctx) {
            if (this.ctx.state !== 'running') this.ctx.resume();
            return;
        }
        const C = window.AudioContext || window.webkitAudioContext;
        if (!C) return;
        const ctx = this.ctx = new C();
        this.master = ctx.createGain();
        this.master.gain.value = 0.7;
        this.master.connect(ctx.destination);
        this.sfx = ctx.createGain();
        this.sfx.connect(this.master);
        this.music = ctx.createGain();
        this.music.gain.value = 0.55;
        this.music.connect(this.master);
        const n = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate),
            d = n.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
        this.noiseBuf = n;
        // engine
        this.eng = ctx.createOscillator();
        this.eng.type = 'sawtooth';
        this.engF = ctx.createBiquadFilter();
        this.engF.type = 'lowpass';
        this.engF.frequency.value = 500;
        this.engG = ctx.createGain();
        this.engG.gain.value = 0;
        this.eng.connect(this.engF).connect(this.engG).connect(this.sfx);
        this.eng.start();
        // siren
        this.sir = ctx.createOscillator();
        this.sir.type = 'square';
        this.sirG = ctx.createGain();
        this.sirG.gain.value = 0;
        const sf = ctx.createBiquadFilter();
        sf.type = 'lowpass';
        sf.frequency.value = 1800;
        this.sir.connect(sf).connect(this.sirG).connect(this.sfx);
        this.sir.start();
        // rotor
        this.rot = this.noise();
        this.rot.loop = true;
        const rf = ctx.createBiquadFilter();
        rf.type = 'lowpass';
        rf.frequency.value = 220;
        this.rotG = ctx.createGain();
        this.rotG.gain.value = 0;
        this.rot.connect(rf).connect(this.rotG).connect(this.sfx);
        this.rot.start();
    }

    get live() {
        return this.ctx && this.ctx.state === 'running';
    }
    noise() {
        const s = this.ctx.createBufferSource();
        s.buffer = this.noiseBuf;
        return s;
    }
    burst(freq, q, dur, vol, type = 'bandpass', at = 0) {
        if (!this.live) return;
        const c = this.ctx,
            t = c.currentTime + at,
            s = this.noise(),
            f = c.createBiquadFilter(),
            g = c.createGain();
        f.type = type;
        f.frequency.value = freq;
        f.Q.value = q;
        g.gain.setValueAtTime(vol, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + dur);
        s.connect(f).connect(g).connect(this.sfx);
        s.start(t, Math.random());
        s.stop(t + dur + 0.05);
    }
    tone(freq, dur, vol, type = 'sine', at = 0, slide = 0) {
        if (!this.live) return;
        const c = this.ctx,
            t = c.currentTime + at,
            o = c.createOscillator(),
            g = c.createGain();
        o.type = type;
        o.frequency.setValueAtTime(freq, t);
        if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + dur);
        g.gain.setValueAtTime(vol, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + dur);
        o.connect(g).connect(this.sfx);
        o.start(t);
        o.stop(t + dur + 0.05);
    }

    gunshot(kind, dist = 0) {
        const v = kind === 'npc' ? Math.max(0.05, 0.5 - dist / 120) : 0.8;
        if (kind === 'shotgun') {
            this.burst(700, 0.6, 0.45, v * 1.2, 'lowpass');
            this.tone(90, 0.25, v * 0.6, 'sine', 0, 40);
        } else if (kind === 'rifle') {
            this.burst(1500, 0.8, 0.22, v);
            this.tone(140, 0.12, v * 0.5, 'sine', 0, 60);
        } else {
            this.burst(kind === 'smg' ? 2000 : 1200, 0.7, kind === 'smg' ? 0.12 : 0.18, v);
            this.tone(160, 0.08, v * 0.4, 'sine', 0, 70);
        }
    }
    explosion() {
        this.burst(300, 0.4, 1.8, 1.3, 'lowpass');
        this.tone(70, 1.2, 0.9, 'sine', 0, 25);
    }
    crash(k) {
        this.burst(500, 0.5, 0.35, Math.min(1, 0.3 + k), 'lowpass');
        this.burst(3000, 2, 0.2, Math.min(0.5, k * 0.5));
    }
    thud() {
        this.burst(180, 1, 0.2, 0.6, 'lowpass');
    }
    punch() {
        this.burst(260, 1.2, 0.12, 0.5, 'lowpass');
    }
    click() {
        this.tone(1800, 0.03, 0.2, 'square');
    }
    door() {
        this.burst(420, 2, 0.12, 0.4);
        this.burst(200, 1, 0.15, 0.3, 'lowpass', 0.08);
    }
    pickup() {
        this.tone(880, 0.12, 0.25, 'triangle');
        this.tone(1320, 0.18, 0.25, 'triangle', 0.08);
    }
    cash() {
        this.tone(1568, 0.1, 0.2, 'square');
        this.tone(2093, 0.2, 0.2, 'square', 0.06);
    }
    horn() {
        this.tone(392, 0.45, 0.25, 'square');
        this.tone(494, 0.45, 0.2, 'square');
    }
    wantedSting() {
        this.tone(660, 0.18, 0.25, 'sawtooth');
        this.tone(440, 0.3, 0.25, 'sawtooth', 0.15);
    }
    sting(kind) {
        const seq = kind === 'pass' ? [523, 659, 784, 1047] : kind === 'fail' ? [392, 349, 311, 262] : [440, 660];
        seq.forEach((f, i) => this.tone(f, 0.35, 0.22, 'triangle', i * 0.13));
    }

    setEngine(on, speed, throttle) {
        if (!this.ctx) return;
        const t = this.ctx.currentTime,
            gear = (Math.abs(speed) % 14) / 14;
        this.eng.frequency.setTargetAtTime(on ? 38 + gear * 55 + Math.abs(speed) * 1.2 : 30, t, 0.05);
        this.engF.frequency.setTargetAtTime(300 + throttle * 900, t, 0.1);
        this.engG.gain.setTargetAtTime(on ? 0.06 + throttle * 0.06 : 0, t, 0.1);
    }
    siren(dist) {
        if (!this.ctx) return;
        const t = this.ctx.currentTime,
            wail = (Math.sin(t * 3.2) + 1) / 2;
        this.sir.frequency.setTargetAtTime(640 + wail * 560, t, 0.03);
        this.sirG.gain.setTargetAtTime(dist < 200 ? 0.07 * (1 - dist / 200) : 0, t, 0.2);
    }
    heli(dist) {
        if (!this.ctx) return;
        const t = this.ctx.currentTime,
            chop = Math.sin(t * 2 * Math.PI * 13) > 0 ? 1 : 0.35;
        this.rotG.gain.setTargetAtTime(dist < 160 ? 0.5 * (1 - dist / 160) * chop : 0, t, 0.01);
    }
}