/**
 * Missions are a list of steps taken in order. A step is finished either by
 * reaching a place or by something happening (an event raised by a
 * conversation, a ride, a train). A mission may have a time limit in game
 * minutes.
 */
import type { Point } from './guide';

export type MissionGoal =
  | { kind: 'reach'; anchor: string; radius?: number }
  | { kind: 'event'; name: string };

export interface MissionStep {
  id: string;
  /** What the player is told to do. */
  text: string;
  goal: MissionGoal;
  /** Anchor to point the player towards, for steps that are not "reach" steps. */
  marker?: string;
}

export interface MissionDef {
  id: string;
  title: string;
  /** Who is asking, as shown on the mission card. */
  giver: string;
  brief: string;
  steps: readonly MissionStep[];
  reward: number;
  /** Clock hour the mission starts at; the clock jumps there. */
  startHour?: number;
  /** Time limit in game minutes. */
  minutes?: number;
  /** Forces rain for the duration. */
  rain?: boolean;
  /** Can be started from the mission list, not only by a character. */
  open?: boolean;
  successText: string;
  failText: string;
}

export type MissionStatus = 'active' | 'done' | 'failed';

export interface MissionProgress {
  id: string;
  status: MissionStatus;
  /** Index of the current step. */
  step: number;
  minutesLeft: number | null;
}

export const DEFAULT_REACH_RADIUS = 28;

export function startMission(def: MissionDef): MissionProgress {
  return { id: def.id, status: 'active', step: 0, minutesLeft: def.minutes ?? null };
}

export function currentStep(def: MissionDef, progress: MissionProgress): MissionStep | null {
  return progress.status === 'active' ? (def.steps[progress.step] ?? null) : null;
}

function advance(def: MissionDef, progress: MissionProgress): MissionProgress {
  const step = progress.step + 1;
  if (step >= def.steps.length) return { ...progress, step: def.steps.length - 1, status: 'done' };
  return { ...progress, step };
}

/** Call as the player moves. Finishes "reach" steps, including several in a row. */
export function missionReach(
  def: MissionDef,
  progress: MissionProgress,
  at: Point,
  positions: Readonly<Record<string, Point>>,
): MissionProgress {
  let next = progress;
  for (;;) {
    const step = currentStep(def, next);
    if (!step || step.goal.kind !== 'reach') return next;
    const target = positions[step.goal.anchor];
    if (!target) return next;
    const radius = step.goal.radius ?? DEFAULT_REACH_RADIUS;
    if (Math.hypot(target.x - at.x, target.z - at.z) > radius) return next;
    next = advance(def, next);
  }
}

/** Call when something happens. Finishes the current step if it was waiting for that. */
export function missionEvent(
  def: MissionDef,
  progress: MissionProgress,
  name: string,
): MissionProgress {
  const step = currentStep(def, progress);
  if (!step || step.goal.kind !== 'event' || step.goal.name !== name) return progress;
  return advance(def, progress);
}

/** Runs the mission clock down by game minutes; fails the mission at zero. */
export function missionTick(progress: MissionProgress, minutes: number): MissionProgress {
  if (progress.status !== 'active' || progress.minutesLeft === null) return progress;
  const minutesLeft = Math.max(0, progress.minutesLeft - minutes);
  return minutesLeft <= 0
    ? { ...progress, minutesLeft: 0, status: 'failed' }
    : { ...progress, minutesLeft };
}

/** Accepts anything (a parsed save) and returns the valid mission records in it. */
export function reviveMissions(
  value: unknown,
  defs: Readonly<Record<string, MissionDef>>,
): Record<string, MissionProgress> {
  const out: Record<string, MissionProgress> = {};
  if (typeof value !== 'object' || value === null) return out;
  for (const [id, entry] of Object.entries(value)) {
    const def = defs[id];
    if (!def || typeof entry !== 'object' || entry === null) continue;
    const raw = entry as Partial<MissionProgress>;
    if (raw.status !== 'active' && raw.status !== 'done' && raw.status !== 'failed') continue;
    const step = typeof raw.step === 'number' && Number.isInteger(raw.step) ? raw.step : 0;
    out[id] = {
      id,
      status: raw.status,
      step: Math.min(Math.max(0, step), def.steps.length - 1),
      minutesLeft:
        typeof raw.minutesLeft === 'number' && Number.isFinite(raw.minutesLeft)
          ? Math.max(0, raw.minutesLeft)
          : null,
    };
  }
  return out;
}

/** The anchor the player should be heading for right now, if the step has one. */
export function missionTarget(def: MissionDef, progress: MissionProgress): string | null {
  const step = currentStep(def, progress);
  if (!step) return null;
  return step.goal.kind === 'reach' ? step.goal.anchor : (step.marker ?? null);
}
