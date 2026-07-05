/**
 * The Sim's soundscape — synthesized entirely in the browser (no audio files, so
 * nothing to load and nothing a strict CSP can block). A low drone underlies
 * everything and strains as the Sim wears; Providence and wall-bumps ring over
 * it. Off by default and fully toggleable (audio needs a user gesture anyway,
 * and it doubles as the reduced-motion-friendly "quiet" default).
 *
 * The timbre math is a pure function so it can be reasoned about and tested; the
 * WebAudio wiring is a thin shell that no-ops where the API is unavailable.
 */
export interface Timbre {
  /** Drone loudness (grows with wear). */
  readonly gain: number;
  /** Detune in cents (grows with wear — the drone destabilizes). */
  readonly detune: number;
  /** Low-pass cutoff in Hz (falls with wear — the sound darkens, strains). */
  readonly cutoff: number;
}

const clamp01 = (n: number): number => Math.max(0, Math.min(1, n));

/** Map accumulated wear (0..1) to the drone's timbre. */
export function wearToTimbre(wear: number): Timbre {
  const w = clamp01(wear);
  return {
    gain: 0.035 + w * 0.06,
    detune: w * 20,
    cutoff: 340 - w * 160,
  };
}

type WebkitWindow = Window & { webkitAudioContext?: typeof AudioContext };

export class Soundscape {
  private ctx: AudioContext | null = null;
  private drone: {
    osc1: OscillatorNode;
    osc2: OscillatorNode;
    filter: BiquadFilterNode;
    gain: GainNode;
  } | null = null;
  private enabled = false;
  private wear = 0;

  /** Whether audio is currently on. */
  get isOn(): boolean {
    return this.enabled;
  }

  /** Turn the soundscape on (starts the drone) or off. Safe to call repeatedly. */
  async setEnabled(on: boolean): Promise<void> {
    this.enabled = on;
    if (on) {
      const ctx = this.ensureContext();
      if (!ctx) return;
      try {
        await ctx.resume();
      } catch {
        /* resume can reject if there was no gesture; the toggle click is one */
      }
      this.startDrone();
    } else {
      this.stopDrone();
    }
  }

  /** Update the strain the drone expresses. */
  setWear(wear: number): void {
    this.wear = wear;
    if (!this.drone || !this.ctx) return;
    const t = wearToTimbre(wear);
    const now = this.ctx.currentTime;
    this.drone.gain.gain.setTargetAtTime(t.gain, now, 0.5);
    this.drone.filter.frequency.setTargetAtTime(t.cutoff, now, 0.5);
    this.drone.osc2.detune.setTargetAtTime(t.detune, now, 0.5);
  }

  /** A warm, consonant bell — approval from somewhere outside. */
  reward(): void {
    this.ping({ freq: 528, type: 'sine', peak: 0.16, decay: 0.9 });
    this.ping({ freq: 792, type: 'sine', peak: 0.07, decay: 0.7 });
  }

  /** A low, dissonant press — displeasure. */
  punish(): void {
    this.ping({ freq: 92, type: 'triangle', peak: 0.18, decay: 1.1 });
    this.ping({ freq: 97, type: 'triangle', peak: 0.12, decay: 1.0 });
  }

  /** A soft thud against an unyielding wall. */
  bump(): void {
    this.ping({ freq: 70, type: 'sine', peak: 0.12, decay: 0.16 });
  }

  /** Release all audio resources. */
  dispose(): void {
    this.stopDrone();
    void this.ctx?.close().catch(() => {});
    this.ctx = null;
  }

  private ensureContext(): AudioContext | null {
    if (this.ctx) return this.ctx;
    const Ctor = window.AudioContext ?? (window as WebkitWindow).webkitAudioContext;
    if (!Ctor) return null;
    this.ctx = new Ctor();
    return this.ctx;
  }

  private startDrone(): void {
    if (this.drone || !this.ctx) return;
    const ctx = this.ctx;
    const t = wearToTimbre(this.wear);

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = t.cutoff;

    const gain = ctx.createGain();
    gain.gain.value = 0;
    gain.gain.setTargetAtTime(t.gain, ctx.currentTime, 1.5); // fade in

    const osc1 = ctx.createOscillator();
    osc1.type = 'sawtooth';
    osc1.frequency.value = 55; // A1
    const osc2 = ctx.createOscillator();
    osc2.type = 'sawtooth';
    osc2.frequency.value = 82.41; // E2 — a bare fifth
    osc2.detune.value = t.detune;

    osc1.connect(filter);
    osc2.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    osc1.start();
    osc2.start();

    this.drone = { osc1, osc2, filter, gain };
  }

  private stopDrone(): void {
    if (!this.drone || !this.ctx) return;
    const { osc1, osc2, gain } = this.drone;
    const now = this.ctx.currentTime;
    gain.gain.setTargetAtTime(0, now, 0.4); // fade out
    osc1.stop(now + 1.2);
    osc2.stop(now + 1.2);
    this.drone = null;
  }

  private ping(opts: { freq: number; type: OscillatorType; peak: number; decay: number }): void {
    if (!this.enabled || !this.ctx) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = opts.type;
    osc.frequency.value = opts.freq;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(opts.peak, now + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + opts.decay);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + opts.decay + 0.05);
  }
}
