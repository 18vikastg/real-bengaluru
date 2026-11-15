import { RADIO_STATIONS, RAGAS } from '@blr/content';
import type { RadioStation } from '@blr/content';
import { create } from 'zustand';

/**
 * The in-game radio and the city's background sound. Everything hangs off
 * one AudioContext, created on the first click (browsers will not start
 * audio before that).
 */
export interface Track {
  title: string;
  artist?: string;
  url: string;
}

type Status = 'off' | 'loading' | 'playing' | 'error';

interface RadioState {
  stations: RadioStation[];
  stationId: string;
  status: Status;
  nowPlaying: string;
  message: string;
  volume: number;
  /** City sounds: traffic, rain, horns, your auto's engine. */
  sounds: boolean;
  bundled: Track[];
  device: Track[];

  tune: (stationId: string) => void;
  stop: () => void;
  skip: () => void;
  setVolume: (volume: number) => void;
  setSounds: (on: boolean) => void;
  addFiles: (files: FileList | null) => void;
  addStream: (name: string, url: string) => string | null;
  removeStation: (id: string) => void;
}

interface Saved {
  volume?: number;
  sounds?: boolean;
  stationId?: string;
  custom?: { id: string; name: string; url: string }[];
}

const KEY = 'real-bengaluru.radio.v1';
const HLS_CDN: string = 'https://cdn.jsdelivr.net/npm/hls.js@1/+esm';

function readSaved(): Saved {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(KEY) ?? '{}');
    return typeof parsed === 'object' && parsed !== null ? (parsed as Saved) : {};
  } catch {
    return {};
  }
}

const saved: Saved = typeof window === 'undefined' ? {} : readSaved();

function customStations(): RadioStation[] {
  const out: RadioStation[] = [];
  for (const entry of Array.isArray(saved.custom) ? saved.custom : []) {
    if (typeof entry?.id !== 'string' || typeof entry.name !== 'string') continue;
    if (typeof entry.url !== 'string' || !/^https?:\/\//.test(entry.url)) continue;
    out.push({
      id: entry.id,
      name: entry.name,
      band: 'Saved',
      kind: 'stream',
      blurb: 'A station you added.',
      url: entry.url,
    });
  }
  return out;
}

// ---------------------------------------------------------------- audio graph

let context: AudioContext | null = null;
let musicBus: GainNode | null = null;
let soundBus: GainNode | null = null;

/** Call from a click or key press. Safe to call repeatedly. */
export function unlockAudio(): AudioContext | null {
  if (typeof window === 'undefined' || typeof AudioContext === 'undefined') return null;
  if (!context) {
    try {
      context = new AudioContext();
    } catch {
      return null;
    }
    musicBus = context.createGain();
    soundBus = context.createGain();
    musicBus.connect(context.destination);
    soundBus.connect(context.destination);
    musicBus.gain.value = useRadio.getState().volume;
    soundBus.gain.value = useRadio.getState().sounds ? 1 : 0;
  }
  if (context.state === 'suspended') void context.resume();
  return context;
}

export function soundOutput(): { context: AudioContext; bus: GainNode } | null {
  return context && soundBus ? { context, bus: soundBus } : null;
}

// ---------------------------------------------------------------- Raga FM

/**
 * A small generative player: a plucked tanpura drone on the tonic and
 * fifth, a hand-drum pulse, and a lead voice that wanders up and down a
 * raga's scale in short phrases, sliding between some notes.
 */
class RagaSynth {
  private timer = 0;
  private next = 0;
  private beat = 0;
  private degree = 0;
  private direction = 1;
  private rest = 0;
  private raga = RAGAS[0] as (typeof RAGAS)[number];
  private ragaBeats = 0;
  private out: GainNode | null = null;
  private readonly tonic = 146.83; // D3
  private readonly tempo = 0.36; // seconds per beat

  start(ctx: AudioContext, bus: GainNode, onRaga: (name: string) => void): void {
    this.stop();
    const out = ctx.createGain();
    out.gain.value = 0.0001;
    out.gain.exponentialRampToValueAtTime(0.9, ctx.currentTime + 1.5);
    // A short echo stands in for a room.
    const delay = ctx.createDelay(1);
    delay.delayTime.value = 0.27;
    const feedback = ctx.createGain();
    feedback.gain.value = 0.28;
    out.connect(bus);
    out.connect(delay);
    delay.connect(feedback);
    feedback.connect(delay);
    delay.connect(bus);
    this.out = out;
    this.next = ctx.currentTime + 0.1;
    this.beat = 0;
    this.ragaBeats = 0;
    this.raga = RAGAS[Math.floor(Math.random() * RAGAS.length)] as (typeof RAGAS)[number];
    onRaga(this.raga.name);
    this.timer = window.setInterval(() => {
      while (this.next < ctx.currentTime + 0.4) {
        this.schedule(ctx, this.next, onRaga);
        this.next += this.tempo;
        this.beat++;
      }
    }, 100);
  }

  stop(): void {
    if (this.timer) window.clearInterval(this.timer);
    this.timer = 0;
    const out = this.out;
    this.out = null;
    if (out) {
      const ctx = out.context;
      out.gain.cancelScheduledValues(ctx.currentTime);
      out.gain.setTargetAtTime(0, ctx.currentTime, 0.15);
      window.setTimeout(() => out.disconnect(), 1200);
    }
  }

  private pitch(index: number): number {
    const scale = this.raga.scale;
    const octave = Math.floor(index / scale.length);
    const step = scale[((index % scale.length) + scale.length) % scale.length] ?? 0;
    return this.tonic * 2 ** (octave + step / 12);
  }

  private pluck(
    ctx: AudioContext,
    at: number,
    frequency: number,
    gain: number,
    length: number,
  ): void {
    if (!this.out) return;
    const envelope = ctx.createGain();
    envelope.gain.setValueAtTime(0.0001, at);
    envelope.gain.exponentialRampToValueAtTime(gain, at + 0.02);
    envelope.gain.exponentialRampToValueAtTime(0.0001, at + length);
    envelope.connect(this.out);
    for (const [multiple, level] of [
      [1, 1],
      [2, 0.5],
      [3, 0.3],
      [4, 0.12],
    ] as const) {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = frequency * multiple;
      const part = ctx.createGain();
      part.gain.value = level;
      osc.connect(part);
      part.connect(envelope);
      osc.start(at);
      osc.stop(at + length + 0.05);
    }
  }

  private drum(ctx: AudioContext, at: number, low: boolean): void {
    if (!this.out) return;
    const osc = ctx.createOscillator();
    const envelope = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(low ? 150 : 320, at);
    osc.frequency.exponentialRampToValueAtTime(low ? 62 : 210, at + 0.12);
    envelope.gain.setValueAtTime(low ? 0.5 : 0.16, at);
    envelope.gain.exponentialRampToValueAtTime(0.0001, at + (low ? 0.3 : 0.1));
    osc.connect(envelope);
    envelope.connect(this.out);
    osc.start(at);
    osc.stop(at + 0.35);
  }

  private lead(ctx: AudioContext, at: number, from: number, to: number, length: number): void {
    if (!this.out) return;
    const osc = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const envelope = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(from, at);
    osc.frequency.exponentialRampToValueAtTime(to, at + Math.min(0.09, length / 3));
    // A slow wobble, as a singer or a flute would add.
    const wobble = ctx.createOscillator();
    const depth = ctx.createGain();
    wobble.frequency.value = 5.2;
    depth.gain.value = to * 0.006;
    wobble.connect(depth);
    depth.connect(osc.frequency);
    filter.type = 'lowpass';
    filter.frequency.value = 2200;
    envelope.gain.setValueAtTime(0.0001, at);
    envelope.gain.exponentialRampToValueAtTime(0.22, at + 0.04);
    envelope.gain.setValueAtTime(0.2, at + length * 0.6);
    envelope.gain.exponentialRampToValueAtTime(0.0001, at + length);
    osc.connect(filter);
    filter.connect(envelope);
    envelope.connect(this.out);
    osc.start(at);
    wobble.start(at);
    osc.stop(at + length + 0.05);
    wobble.stop(at + length + 0.05);
  }

  private schedule(ctx: AudioContext, at: number, onRaga: (name: string) => void): void {
    const beat = this.beat % 8;
    // Tanpura: fifth, upper tonic, upper tonic, tonic, over eight beats.
    if (beat === 0) this.pluck(ctx, at, this.tonic * 0.75, 0.16, 2.6);
    if (beat === 2 || beat === 4) this.pluck(ctx, at, this.tonic, 0.15, 2.4);
    if (beat === 6) this.pluck(ctx, at, this.tonic / 2, 0.2, 2.8);
    // An eight-beat cycle on the drum.
    if (beat === 0 || beat === 3 || beat === 6) this.drum(ctx, at, true);
    else if (beat !== 5) this.drum(ctx, at, false);

    // The melody: phrases of a few notes, then a breath.
    if (this.rest > 0) {
      this.rest--;
    } else {
      const previous = this.pitch(this.degree + this.raga.scale.length);
      const roll = Math.random();
      if (roll < 0.12) this.direction = -this.direction;
      const stride = roll > 0.85 ? 2 : 1;
      this.degree += this.direction * stride;
      const size = this.raga.scale.length;
      if (this.degree > size + 2) this.direction = -1;
      if (this.degree < -2) this.direction = 1;
      const long = Math.random() < 0.25;
      const length = this.tempo * (long ? 1.9 : 0.95);
      this.lead(ctx, at, previous, this.pitch(this.degree + size), length);
      if (long) this.rest = 1;
      // Phrases come home to the tonic or the fifth, then pause.
      if (Math.random() < 0.14) {
        this.degree = Math.random() < 0.6 ? 0 : 3;
        this.rest = 2 + Math.floor(Math.random() * 3);
      }
    }

    this.ragaBeats++;
    if (this.ragaBeats > 420 && beat === 7) {
      this.ragaBeats = 0;
      let pick = this.raga;
      while (pick === this.raga)
        pick = RAGAS[Math.floor(Math.random() * RAGAS.length)] as typeof pick;
      this.raga = pick;
      this.degree = 0;
      this.rest = 4;
      onRaga(pick.name);
    }
  }
}

// ---------------------------------------------------------------- playback

const synth = new RagaSynth();
let element: HTMLAudioElement | null = null;
let hls: { destroy: () => void } | null = null;
let queue: Track[] = [];
let queueIndex = 0;

function player(): HTMLAudioElement {
  if (!element) {
    element = new Audio();
    element.preload = 'none';
    element.addEventListener('playing', () =>
      useRadio.setState({ status: 'playing', message: '' }),
    );
    element.addEventListener('waiting', () => {
      if (useRadio.getState().status !== 'off') useRadio.setState({ status: 'loading' });
    });
    element.addEventListener('ended', () => useRadio.getState().skip());
    element.addEventListener('error', () => {
      if (useRadio.getState().status === 'off') return;
      useRadio.setState({
        status: 'error',
        message:
          'Could not play this. The station may be off air, or the file type is not supported.',
      });
    });
  }
  return element;
}

function silence(): void {
  synth.stop();
  hls?.destroy();
  hls = null;
  if (element) {
    element.pause();
    element.removeAttribute('src');
    element.load();
  }
}

async function playUrl(url: string): Promise<void> {
  const audio = player();
  audio.volume = useRadio.getState().volume;
  const isHls = /\.m3u8(\?|$)/i.test(url);
  if (isHls && !audio.canPlayType('application/vnd.apple.mpegurl')) {
    // Most browsers need a helper for HLS streams. It is fetched only when such a station is tuned.
    interface HlsLike {
      loadSource: (source: string) => void;
      attachMedia: (media: HTMLMediaElement) => void;
      destroy: () => void;
    }
    const module = (await import(/* @vite-ignore */ HLS_CDN)) as {
      default: { new (): HlsLike; isSupported: () => boolean };
    };
    if (!module.default.isSupported()) throw new Error('HLS is not supported in this browser');
    const instance = new module.default();
    instance.loadSource(url);
    instance.attachMedia(audio);
    hls = instance;
  } else {
    audio.src = url;
  }
  await audio.play();
}

function playQueue(): void {
  const track = queue[queueIndex];
  if (!track) {
    useRadio.setState({ status: 'error', message: 'No songs here yet.' });
    return;
  }
  useRadio.setState({
    status: 'loading',
    nowPlaying: track.artist ? `${track.title} · ${track.artist}` : track.title,
  });
  playUrl(track.url).catch(() => {
    if (useRadio.getState().status !== 'off') {
      useRadio.setState({ status: 'error', message: `Could not play “${track.title}”.` });
    }
  });
}

function persist(): void {
  const state = useRadio.getState();
  try {
    window.localStorage.setItem(
      KEY,
      JSON.stringify({
        volume: state.volume,
        sounds: state.sounds,
        stationId: state.stationId,
        custom: state.stations
          .filter((station) => station.band === 'Saved')
          .map((station) => ({ id: station.id, name: station.name, url: station.url ?? '' })),
      } satisfies Saved),
    );
  } catch {
    // No storage: settings last for this visit only.
  }
}

export const useRadio = create<RadioState>((set, get) => ({
  stations: [...RADIO_STATIONS, ...customStations()],
  stationId: typeof saved.stationId === 'string' ? saved.stationId : 'raga',
  status: 'off',
  nowPlaying: '',
  message: '',
  volume: typeof saved.volume === 'number' ? Math.min(1, Math.max(0, saved.volume)) : 0.6,
  sounds: saved.sounds !== false,
  bundled: [],
  device: [],

  tune: (stationId) => {
    const station = get().stations.find((entry) => entry.id === stationId);
    const ctx = unlockAudio();
    if (!station) return;
    silence();
    set({ stationId, status: 'loading', nowPlaying: '', message: '' });
    persist();
    if (station.kind === 'synth') {
      if (!ctx || !musicBus) {
        set({ status: 'error', message: 'This browser cannot generate audio.' });
        return;
      }
      synth.start(ctx, musicBus, (raga) => set({ nowPlaying: `Raga ${raga}` }));
      set({ status: 'playing' });
    } else if (station.kind === 'stream') {
      set({ nowPlaying: 'Live' });
      playUrl(station.url ?? '').catch(() => {
        if (get().stationId === stationId && get().status !== 'off') {
          set({ status: 'error', message: 'This station is not reachable right now.' });
        }
      });
    } else {
      queue = station.kind === 'tracks' ? get().bundled : get().device;
      queueIndex = 0;
      if (queue.length === 0) {
        set({
          status: 'error',
          message:
            station.kind === 'device'
              ? 'Choose some songs from your device first.'
              : 'No songs have been added to the mixtape yet.',
        });
        return;
      }
      playQueue();
    }
  },

  stop: () => {
    silence();
    set({ status: 'off', nowPlaying: '', message: '' });
  },

  skip: () => {
    const state = get();
    const station = state.stations.find((entry) => entry.id === state.stationId);
    if (state.status === 'off' || !station) return;
    if (station.kind === 'tracks' || station.kind === 'device') {
      if (queue.length === 0) return;
      queueIndex = (queueIndex + 1) % queue.length;
      silence();
      playQueue();
    } else {
      // On the dial, "next" moves to the next station.
      const index = state.stations.indexOf(station);
      const next = state.stations[(index + 1) % state.stations.length];
      if (next) state.tune(next.id);
    }
  },

  setVolume: (volume) => {
    const value = Math.min(1, Math.max(0, volume));
    set({ volume: value });
    if (element) element.volume = value;
    if (musicBus && context) musicBus.gain.setTargetAtTime(value, context.currentTime, 0.05);
    persist();
  },

  setSounds: (on) => {
    set({ sounds: on });
    unlockAudio();
    if (soundBus && context) soundBus.gain.setTargetAtTime(on ? 1 : 0, context.currentTime, 0.1);
    persist();
  },

  addFiles: (files) => {
    if (!files || files.length === 0) return;
    const added: Track[] = [];
    for (const file of Array.from(files)) {
      if (!file.type.startsWith('audio/')) continue;
      added.push({ title: file.name.replace(/\.[^.]+$/, ''), url: URL.createObjectURL(file) });
    }
    if (added.length === 0) return;
    set({ device: [...get().device, ...added] });
    get().tune('device');
  },

  addStream: (name, url) => {
    const clean = url.trim();
    if (!/^https:\/\/\S+$/.test(clean)) return 'Paste a stream address that starts with https://';
    const id = `custom-${Date.now().toString(36)}`;
    const station: RadioStation = {
      id,
      name: name.trim() || 'My station',
      band: 'Saved',
      kind: 'stream',
      blurb: 'A station you added.',
      url: clean,
    };
    set({ stations: [...get().stations, station] });
    get().tune(id);
    return null;
  },

  removeStation: (id) => {
    if (get().stationId === id) get().stop();
    set({
      stations: get().stations.filter((station) => station.id !== id || station.band !== 'Saved'),
    });
    persist();
  },
}));

/** Reads the bundled song list once. A missing or empty file just means an empty mixtape. */
export async function loadBundledTracks(baseUrl: string): Promise<void> {
  try {
    const response = await fetch(`${baseUrl}music/tracks.json`);
    if (!response.ok) return;
    const data = (await response.json()) as { tracks?: unknown };
    const tracks: Track[] = [];
    for (const entry of Array.isArray(data.tracks) ? data.tracks : []) {
      const raw = entry as { title?: unknown; artist?: unknown; file?: unknown };
      if (typeof raw.title !== 'string' || typeof raw.file !== 'string') continue;
      tracks.push({
        title: raw.title,
        url: /^https?:\/\//.test(raw.file) ? raw.file : `${baseUrl}music/${raw.file}`,
        ...(typeof raw.artist === 'string' && { artist: raw.artist }),
      });
    }
    useRadio.setState({ bundled: tracks });
  } catch {
    // No mixtape.
  }
}
