// RadioSynth: four live-sequenced coastal radio stations (Sunset Synthwave, Dembow Playa, Lo-Fi Harbour, Tropic Electro-Funk).
import type { AudioEngine } from './AudioEngine.ts';

export interface StationDef {
  name: string;
  genre: string;
  accent: string;
  bpm: number;
  chords: number[][];
  kick: number[];
  snare: number[];
  hat: 'eighths' | 'sixteenths' | 'swing';
  lead: 'arp' | 'pluck' | 'keys' | 'funk';
  songs: string[];
}

export const STATIONS: readonly StationDef[] = [
  {
    name: 'VICE 98.1 FM',
    genre: 'Sunset Synthwave',
    accent: '#ff2e93',
    bpm: 100,
    chords: [
      [57, 60, 64],
      [53, 57, 60],
      [48, 52, 55],
      [55, 59, 62],
    ],
    kick: [0, 4, 8, 12],
    snare: [4, 12],
    hat: 'eighths',
    lead: 'arp',
    songs: [
      'Neon Tide · The Coastlines',
      'Ocean Drive Mirage · Red Sails',
      'Last Light Run · Comet Club',
    ],
  },
  {
    name: 'WAVE 104.5 FM',
    genre: 'Coastal Club Beats',
    accent: '#00f0d8',
    bpm: 98,
    chords: [
      [50, 53, 57],
      [46, 50, 53],
      [48, 52, 55],
      [45, 48, 52],
    ],
    kick: [0, 4, 8, 12],
    snare: [3, 6, 11, 14],
    hat: 'sixteenths',
    lead: 'pluck',
    songs: [
      'Hot Sand Nights · DJ Tide',
      'Pier After Dark · Sea Breeze',
      'Harbor Bass · South Pier Crew',
    ],
  },
  {
    name: 'PULSE 101.9 FM',
    genre: 'Miami Electro-Funk',
    accent: '#ff7c5c',
    bpm: 114,
    chords: [
      [52, 55, 59, 62],
      [55, 59, 62, 66],
      [50, 54, 57, 60],
      [48, 52, 55, 59],
    ],
    kick: [0, 4, 8, 10, 12],
    snare: [4, 12],
    hat: 'sixteenths',
    lead: 'funk',
    songs: [
      'Chrome Horizon · Velvet Drive',
      'Palm Heights Groove · Neon Syndicate',
      'Midnight Strip · Shadowline',
    ],
  },
  {
    name: 'HARBOR 88.3 FM',
    genre: 'Lo-Fi Marina',
    accent: '#9c7cff',
    bpm: 76,
    chords: [
      [50, 53, 57, 60, 64],
      [43, 47, 50, 53, 57],
      [48, 52, 55, 59, 62],
      [45, 49, 52, 55, 59],
    ],
    kick: [0, 10],
    snare: [4, 12],
    hat: 'swing',
    lead: 'keys',
    songs: [
      'Fog Over Pier 9 · Pelican Bay',
      'Night Ferry · Dawn Mercer',
      'Saltwater Tape · Dockside Quartet',
    ],
  },
];

const hz = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

export class RadioSynth {
  public station = 0;
  public on = false;
  private step = 0;
  private nextT = 0;
  public song = 0;

  constructor(private audio: AudioEngine) {}

  info() {
    const s = STATIONS[this.station];
    return {
      station: s.name,
      genre: s.genre,
      accent: s.accent,
      song: s.songs[this.song % s.songs.length],
    };
  }

  carEntered(v?: { id: number }): void {
    this.on = true;
    if (v) this.station = v.id % STATIONS.length;
    this.retime();
  }

  carLeft(): void {
    this.on = false;
  }

  next(): void {
    this.station = (this.station + 1) % STATIONS.length;
    this.song = 0;
    this.retime();
    this.audio.click();
  }

  private retime(): void {
    if (this.audio.ctx) this.nextT = this.audio.ctx.currentTime + 0.05;
  }

  private note(
    f: number,
    t: number,
    dur: number,
    vol: number,
    type: OscillatorType,
    cutoff = 2000,
  ): void {
    const c = this.audio.ctx!;
    const o = c.createOscillator();
    const g = c.createGain();
    const fl = c.createBiquadFilter();
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

  private drum(kind: 'kick' | 'snare' | 'hat', t: number): void {
    const c = this.audio.ctx!;
    if (kind === 'kick') {
      const o = c.createOscillator();
      const g = c.createGain();
      o.frequency.setValueAtTime(140, t);
      o.frequency.exponentialRampToValueAtTime(42, t + 0.14);
      g.gain.setValueAtTime(0.65, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
      o.connect(g).connect(this.audio.music);
      o.start(t);
      o.stop(t + 0.35);
      return;
    }
    const s = this.audio.noise();
    const f = c.createBiquadFilter();
    const g = c.createGain();
    f.type = kind === 'hat' ? 'highpass' : 'bandpass';
    f.frequency.value = kind === 'hat' ? 7000 : 1800;
    const dur = kind === 'hat' ? 0.04 : 0.16;
    g.gain.setValueAtTime(kind === 'hat' ? 0.1 : 0.32, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    s.connect(f).connect(g).connect(this.audio.music);
    s.start(t, Math.random());
    s.stop(t + dur + 0.02);
  }

  update(): void {
    const A = this.audio;
    if (!A.ctx || A.muted) return;
    A.music.gain.setTargetAtTime(this.on ? 0.45 : 0, A.ctx.currentTime, 0.3);
    if (!this.on) return;
    const S = STATIONS[this.station];
    const sixteenth = 60 / S.bpm / 4;
    if (this.nextT < A.ctx.currentTime) this.nextT = A.ctx.currentTime + 0.05;
    while (this.nextT < A.ctx.currentTime + 0.15) {
      const t = this.nextT;
      const st = this.step % 16;
      const ch = S.chords[Math.floor(this.step / 16) % 4];
      if (S.kick.includes(st)) this.drum('kick', t);
      if (S.snare.includes(st)) this.drum('snare', t);
      if (
        S.hat === 'sixteenths' ||
        (S.hat === 'eighths' && st % 2 === 0) ||
        (S.hat === 'swing' && st % 4 === 2)
      ) {
        this.drum('hat', t);
      }
      if (st % 4 === 0) {
        this.note(hz(ch[0] - 24), t, sixteenth * 3.5, 0.2, 'sawtooth', 380);
      }
      if (st === 0) {
        for (const m of ch) {
          this.note(
            hz(m),
            t,
            sixteenth * 15,
            S.lead === 'keys' ? 0.045 : 0.035,
            S.lead === 'keys' ? 'triangle' : 'sawtooth',
            1200,
          );
        }
      }
      if (S.lead === 'arp') {
        this.note(hz(ch[st % ch.length] + 12), t, sixteenth * 0.9, 0.045, 'square', 2600);
      }
      if (S.lead === 'pluck' && [0, 3, 6, 10, 13].includes(st)) {
        this.note(
          hz(ch[(st * 7) % ch.length] + 12),
          t,
          sixteenth * 1.5,
          0.075,
          'triangle',
          3000,
        );
      }
      if (S.lead === 'funk' && [0, 2, 6, 9, 12, 14].includes(st)) {
        this.note(
          hz(ch[(st * 3) % ch.length] + 12),
          t,
          sixteenth * 1.2,
          0.06,
          'sawtooth',
          2200,
        );
      }
      if (S.lead === 'keys' && (st === 6 || st === 14)) {
        this.note(
          hz(ch[(this.step >> 4) % ch.length] + 12),
          t,
          sixteenth * 6,
          0.055,
          'sine',
        );
      }
      this.nextT +=
        sixteenth *
        (S.hat === 'swing' && st % 2 === 0 ? 1.15 : S.hat === 'swing' ? 0.85 : 1);
      this.step++;
      if (this.step % 256 === 0) this.song++;
    }
  }
}
