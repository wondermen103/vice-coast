// AudioEngine: procedural WebAudio effects (engine, nitrous boost, weapons, thunder, siren, rotor, UI stings) + mute control.
export class AudioEngine {
  public ctx: AudioContext | null = null;
  public muted = false;
  public master!: GainNode;
  public sfx!: GainNode;
  public music!: GainNode;
  private noiseBuf!: AudioBuffer;
  private eng!: OscillatorNode;
  private engF!: BiquadFilterNode;
  private engG!: GainNode;
  private sir!: OscillatorNode;
  private sirG!: GainNode;
  private rot!: AudioBufferSourceNode;
  private rotG!: GainNode;

  start(): void {
    if (this.ctx) {
      if (this.ctx.state !== 'running') {
        this.ctx.resume().catch(() => {});
      }
      return;
    }
    const C =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!C) return;
    const ctx = (this.ctx = new C());
    this.master = ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.68;
    this.master.connect(ctx.destination);

    this.sfx = ctx.createGain();
    this.sfx.connect(this.master);

    this.music = ctx.createGain();
    this.music.gain.value = 0.5;
    this.music.connect(this.master);

    const n = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = n.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    this.noiseBuf = n;

    // Engine oscillator
    this.eng = ctx.createOscillator();
    this.eng.type = 'sawtooth';
    this.engF = ctx.createBiquadFilter();
    this.engF.type = 'lowpass';
    this.engF.frequency.value = 500;
    this.engG = ctx.createGain();
    this.engG.gain.value = 0;
    this.eng.connect(this.engF).connect(this.engG).connect(this.sfx);
    this.eng.start();

    // Siren oscillator
    this.sir = ctx.createOscillator();
    this.sir.type = 'square';
    this.sirG = ctx.createGain();
    this.sirG.gain.value = 0;
    const sf = ctx.createBiquadFilter();
    sf.type = 'lowpass';
    sf.frequency.value = 1800;
    this.sir.connect(sf).connect(this.sirG).connect(this.sfx);
    this.sir.start();

    // Helicopter rotor loop
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

  setMuted(m: boolean): void {
    this.muted = m;
    if (this.ctx && this.master) {
      this.master.gain.setTargetAtTime(m ? 0 : 0.68, this.ctx.currentTime, 0.04);
    }
  }

  toggleMute(): boolean {
    this.setMuted(!this.muted);
    return this.muted;
  }

  silenceLoops(): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.engG.gain.setTargetAtTime(0, t, 0.05);
    this.sirG.gain.setTargetAtTime(0, t, 0.05);
    this.rotG.gain.setTargetAtTime(0, t, 0.05);
    this.music.gain.setTargetAtTime(0, t, 0.08);
  }

  get live(): boolean {
    return !!this.ctx && this.ctx.state === 'running' && !this.muted;
  }

  noise(): AudioBufferSourceNode {
    const s = this.ctx!.createBufferSource();
    s.buffer = this.noiseBuf;
    return s;
  }

  burst(
    freq: number,
    q: number,
    dur: number,
    vol: number,
    type: BiquadFilterType = 'bandpass',
    at = 0,
  ): void {
    if (!this.live || !this.ctx) return;
    const c = this.ctx;
    const t = c.currentTime + at;
    const s = this.noise();
    const f = c.createBiquadFilter();
    const g = c.createGain();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    s.connect(f).connect(g).connect(this.sfx);
    s.start(t, Math.random());
    s.stop(t + dur + 0.05);
  }

  tone(
    freq: number,
    dur: number,
    vol: number,
    type: OscillatorType = 'sine',
    at = 0,
    slide = 0,
  ): void {
    if (!this.live || !this.ctx) return;
    const c = this.ctx;
    const t = c.currentTime + at;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(this.sfx);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  gunshot(kind: string, dist = 0): void {
    const pitch = 0.94 + Math.random() * 0.12;
    const v = kind === 'npc' ? Math.max(0.05, 0.5 - dist / 120) : 0.78;
    if (kind === 'launcher') {
      this.burst(280, 0.5, 0.35, v * 1.1, 'lowpass');
      this.tone(130 * pitch, 0.24, v * 0.7, 'triangle', 0, 48);
    } else if (kind === 'shotgun') {
      this.burst(700 * pitch, 0.6, 0.45, v * 1.15, 'lowpass');
      this.tone(90 * pitch, 0.25, v * 0.6, 'sine', 0, 40);
    } else if (kind === 'rifle') {
      this.burst(1500 * pitch, 0.8, 0.22, v);
      this.tone(140 * pitch, 0.12, v * 0.5, 'sine', 0, 60);
    } else {
      this.burst(
        (kind === 'smg' ? 2000 : 1200) * pitch,
        0.7,
        kind === 'smg' ? 0.12 : 0.18,
        v,
      );
      this.tone(160 * pitch, 0.08, v * 0.4, 'sine', 0, 70);
    }
  }

  hitmarker(): void {
    this.tone(2400, 0.04, 0.14, 'triangle', 0, 1600);
  }

  stuntBonus(): void {
    this.tone(587, 0.14, 0.22, 'triangle', 0);
    this.tone(880, 0.16, 0.22, 'triangle', 0.09);
    this.tone(1175, 0.24, 0.24, 'triangle', 0.18);
  }

  thunder(): void {
    this.burst(110, 0.35, 2.2, 0.65, 'lowpass', 0.15);
    this.tone(52, 1.5, 0.32, 'sine', 0.12, 24);
  }

  explosion(): void {
    this.burst(300, 0.4, 1.8, 1.3, 'lowpass');
    this.tone(70, 1.2, 0.9, 'sine', 0, 25);
  }

  crash(k: number): void {
    this.burst(500, 0.5, 0.35, Math.min(1, 0.3 + k), 'lowpass');
    this.burst(3000, 2, 0.2, Math.min(0.5, k * 0.5));
  }

  thud(): void {
    this.burst(180, 1, 0.2, 0.6, 'lowpass');
  }

  punch(): void {
    this.burst(260, 1.2, 0.12, 0.5, 'lowpass');
  }

  click(): void {
    this.tone(1800, 0.03, 0.18, 'square');
  }

  door(): void {
    this.burst(420, 2, 0.12, 0.4);
    this.burst(200, 1, 0.15, 0.3, 'lowpass', 0.08);
  }

  pickup(): void {
    this.tone(880, 0.12, 0.25, 'triangle');
    this.tone(1320, 0.18, 0.25, 'triangle', 0.08);
  }

  cash(): void {
    this.tone(1568, 0.1, 0.2, 'square');
    this.tone(2093, 0.2, 0.2, 'square', 0.06);
  }

  horn(): void {
    this.tone(392, 0.45, 0.25, 'square');
    this.tone(494, 0.45, 0.2, 'square');
  }

  wantedSting(): void {
    this.tone(660, 0.18, 0.25, 'sawtooth');
    this.tone(440, 0.3, 0.25, 'sawtooth', 0.15);
  }

  sting(kind: 'pass' | 'fail' | 'start'): void {
    const seq =
      kind === 'pass'
        ? [523, 659, 784, 1047]
        : kind === 'fail'
          ? [392, 349, 311, 262]
          : [440, 660];
    seq.forEach((f, i) => this.tone(f, 0.35, 0.22, 'triangle', i * 0.13));
  }

  wantedUp(): void {
    this.wantedSting();
  }

  fanfare(): void {
    this.sting('pass');
  }

  buy(): void {
    this.cash();
  }

  setEngine(on: boolean, speed: number, throttle: number, boosting = false): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const gear = (Math.abs(speed) % 14) / 14;
    const boostAdd = boosting ? 32 : 0;
    this.eng.frequency.setTargetAtTime(
      on ? 38 + gear * 55 + Math.abs(speed) * 1.2 + boostAdd : 30,
      t,
      0.05,
    );
    this.engF.frequency.setTargetAtTime(
      300 + throttle * 900 + (boosting ? 1100 : 0),
      t,
      0.08,
    );
    this.engG.gain.setTargetAtTime(
      on ? 0.055 + throttle * 0.055 + (boosting ? 0.045 : 0) : 0,
      t,
      0.08,
    );
  }

  siren(dist: number): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const wail = (Math.sin(t * 3.2) + 1) / 2;
    this.sir.frequency.setTargetAtTime(640 + wail * 560, t, 0.03);
    this.sirG.gain.setTargetAtTime(dist < 200 ? 0.065 * (1 - dist / 200) : 0, t, 0.2);
  }

  heli(dist: number): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const chop = Math.sin(t * 2 * Math.PI * 13) > 0 ? 1 : 0.35;
    this.rotG.gain.setTargetAtTime(
      dist < 160 ? 0.45 * (1 - dist / 160) * chop : 0,
      t,
      0.01,
    );
  }
}
