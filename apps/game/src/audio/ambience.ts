import { congestion } from '@blr/engine';
import { soundOutput } from './radio';

/**
 * The sound of the street, synthesised: a low traffic rumble that swells at
 * peak hour, rain, the odd horn, and the putter of the auto you are driving.
 * No audio files are involved.
 */
export class Ambience {
  private built = false;
  private traffic: GainNode | null = null;
  private rain: GainNode | null = null;
  private engine: GainNode | null = null;
  private engineTone: OscillatorNode | null = null;
  private chug: OscillatorNode | null = null;
  private hornTimer = 4;
  private readonly nodes: AudioScheduledSourceNode[] = [];

  private build(context: AudioContext, bus: GainNode): void {
    this.built = true;
    // Two seconds of noise, looped: brown for the rumble, white for the rain.
    const length = context.sampleRate * 2;
    const brown = context.createBuffer(1, length, context.sampleRate);
    const white = context.createBuffer(1, length, context.sampleRate);
    const b = brown.getChannelData(0);
    const w = white.getChannelData(0);
    let last = 0;
    for (let i = 0; i < length; i++) {
      const sample = Math.random() * 2 - 1;
      w[i] = sample;
      last = (last + 0.02 * sample) / 1.02;
      b[i] = last * 3.5;
    }
    const loop = (buffer: AudioBuffer, type: BiquadFilterType, frequency: number): GainNode => {
      const source = context.createBufferSource();
      source.buffer = buffer;
      source.loop = true;
      const filter = context.createBiquadFilter();
      filter.type = type;
      filter.frequency.value = frequency;
      const gain = context.createGain();
      gain.gain.value = 0;
      source.connect(filter);
      filter.connect(gain);
      gain.connect(bus);
      source.start();
      this.nodes.push(source);
      return gain;
    };
    this.traffic = loop(brown, 'lowpass', 260);
    this.rain = loop(white, 'highpass', 2400);

    const tone = context.createOscillator();
    tone.type = 'sawtooth';
    tone.frequency.value = 40;
    const chug = context.createOscillator();
    chug.type = 'square';
    chug.frequency.value = 9;
    const chop = context.createGain();
    chop.gain.value = 0.5;
    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 420;
    const engine = context.createGain();
    engine.gain.value = 0;
    // The square wave chops the saw's volume, which is what makes it putter.
    chug.connect(chop.gain);
    tone.connect(chop);
    chop.connect(filter);
    filter.connect(engine);
    engine.connect(bus);
    tone.start();
    chug.start();
    this.nodes.push(tone, chug);
    this.engine = engine;
    this.engineTone = tone;
    this.chug = chug;
  }

  private horn(context: AudioContext, bus: GainNode): void {
    const at = context.currentTime + 0.02;
    const pan = context.createStereoPanner();
    pan.pan.value = Math.random() * 1.6 - 0.8;
    const gain = context.createGain();
    const loud = 0.02 + Math.random() * 0.035;
    const base = 380 + Math.random() * 160;
    const beeps = Math.random() < 0.5 ? 1 : 2;
    gain.gain.value = 0;
    for (let i = 0; i < beeps; i++) {
      const start = at + i * 0.22;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(loud, start + 0.015);
      gain.gain.setValueAtTime(loud, start + 0.13);
      gain.gain.linearRampToValueAtTime(0, start + 0.16);
    }
    for (const ratio of [1, 1.26]) {
      const osc = context.createOscillator();
      osc.type = 'square';
      osc.frequency.value = base * ratio;
      osc.connect(gain);
      osc.start(at);
      osc.stop(at + beeps * 0.22 + 0.1);
    }
    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 1800;
    gain.connect(filter);
    filter.connect(pan);
    pan.connect(bus);
  }

  /** Call every frame while playing. `speed` is the driven auto's speed, or null on foot. */
  update(dt: number, hour: number, raining: boolean, speed: number | null, quiet: boolean): void {
    const output = soundOutput();
    if (!output) return;
    const { context, bus } = output;
    if (!this.built) this.build(context, bus);
    const now = context.currentTime;
    const jam = congestion(hour);
    const mute = quiet ? 0 : 1;
    this.traffic?.gain.setTargetAtTime((0.05 + jam * 0.2) * mute, now, 0.6);
    this.rain?.gain.setTargetAtTime(raining ? 0.05 * mute : 0, now, 1.2);
    const moving = speed === null ? 0 : Math.min(1, Math.abs(speed) / 16);
    this.engine?.gain.setTargetAtTime(
      speed === null ? 0 : (0.05 + moving * 0.07) * mute,
      now,
      0.15,
    );
    this.engineTone?.frequency.setTargetAtTime(38 + moving * 70, now, 0.1);
    this.chug?.frequency.setTargetAtTime(9 + moving * 30, now, 0.1);

    this.hornTimer -= dt;
    if (this.hornTimer <= 0) {
      this.hornTimer = 2 + Math.random() * (14 - jam * 10);
      if (!quiet && jam > 0.1) this.horn(context, bus);
    }
  }

  /** Fades everything out, for the title screen and the pause menu. */
  hush(): void {
    const output = soundOutput();
    if (!output) return;
    const now = output.context.currentTime;
    this.traffic?.gain.setTargetAtTime(0, now, 0.3);
    this.rain?.gain.setTargetAtTime(0, now, 0.3);
    this.engine?.gain.setTargetAtTime(0, now, 0.1);
  }

  dispose(): void {
    for (const node of this.nodes) {
      try {
        node.stop();
      } catch {
        // Already stopped.
      }
    }
    this.nodes.length = 0;
    this.built = false;
  }
}
