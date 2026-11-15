import { create } from 'zustand';

export type Phase = 'title' | 'playing' | 'paused';

export interface WorldStatus {
  loaded: number;
  pending: number;
  total: number;
  near: string | null;
}

interface UiState {
  phase: Phase;
  aboutOpen: boolean;
  /** Local time of day in hours, 0 to 24. */
  hour: number;
  fps: number;
  drawCalls: number;
  triangles: number;
  world: WorldStatus;
  start: () => void;
  pause: () => void;
  resume: () => void;
  quitToTitle: () => void;
  setAboutOpen: (open: boolean) => void;
  setHour: (hour: number) => void;
  setPerf: (fps: number, drawCalls: number, triangles: number) => void;
  setWorld: (world: WorldStatus) => void;
}

export const GOLDEN_HOUR = 16.3;

export const useUi = create<UiState>((set) => ({
  phase: 'title',
  aboutOpen: false,
  hour: GOLDEN_HOUR,
  fps: 0,
  drawCalls: 0,
  triangles: 0,
  world: { loaded: 0, pending: 0, total: 0, near: null },
  start: () => set({ phase: 'playing', aboutOpen: false }),
  pause: () => set((s) => (s.phase === 'playing' ? { phase: 'paused' } : s)),
  resume: () => set((s) => (s.phase === 'paused' ? { phase: 'playing', aboutOpen: false } : s)),
  quitToTitle: () => set({ phase: 'title', aboutOpen: false, hour: GOLDEN_HOUR }),
  setAboutOpen: (aboutOpen) => set({ aboutOpen }),
  setHour: (hour) => set({ hour: Math.min(24, Math.max(0, hour)) }),
  setPerf: (fps, drawCalls, triangles) => set({ fps, drawCalls, triangles }),
  setWorld: (world) => set({ world }),
}));
