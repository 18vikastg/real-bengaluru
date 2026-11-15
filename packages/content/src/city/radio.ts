/**
 * Stations on the in-game radio.
 *
 *  - synth:  music generated live in the browser. Original, needs no files.
 *  - tracks: songs listed in apps/game/public/music/tracks.json. Only put
 *            music there that you have the right to publish.
 *  - device: songs the player picks from their own device. Played locally,
 *            never uploaded.
 *  - stream: a live internet radio stream (MP3, AAC or HLS).
 */
export interface RadioStation {
  id: string;
  name: string;
  /** What the dial shows. */
  band: string;
  kind: 'synth' | 'tracks' | 'device' | 'stream';
  blurb: string;
  url?: string;
}

export const RADIO_STATIONS: readonly RadioStation[] = [
  {
    id: 'raga',
    name: 'Raga FM',
    band: '88.8',
    kind: 'synth',
    blurb: 'A tanpura drone and a melody that never repeats, made live in your browser.',
  },
  {
    id: 'mixtape',
    name: 'Namma Mixtape',
    band: '95.5',
    kind: 'tracks',
    blurb: 'Songs that ship with the game.',
  },
  {
    id: 'device',
    name: 'My Songs',
    band: 'AUX',
    kind: 'device',
    blurb: 'Play Kannada songs (or anything else) from your own device. Nothing is uploaded.',
  },
  {
    id: 'akashvani',
    name: 'Vividh Bharati',
    band: 'Akashvani',
    kind: 'stream',
    blurb: 'Live from All India Radio, when the stream is reachable.',
    url: 'https://air.pc.cdn.bitgravity.com/air/live/pbaudio001/playlist.m3u8',
  },
];

/** Ragas Raga FM wanders through: name and scale in semitones above the tonic. */
export const RAGAS: readonly { name: string; scale: readonly number[] }[] = [
  { name: 'Mohanam', scale: [0, 2, 4, 7, 9] },
  { name: 'Hamsadhwani', scale: [0, 2, 4, 7, 11] },
  { name: 'Madhyamavati', scale: [0, 2, 5, 7, 10] },
  { name: 'Shivaranjani', scale: [0, 2, 3, 7, 9] },
  { name: 'Hindolam', scale: [0, 3, 5, 8, 10] },
];
