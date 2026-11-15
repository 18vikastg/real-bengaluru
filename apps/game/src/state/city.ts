import {
  ANCHORS,
  GUIDE_AREAS,
  MISSIONS,
  MISSIONS_BY_ID,
  NPCS,
  NPCS_BY_ID,
  PARKED_AUTOS,
  STATIONS,
  TRAFFIC_HOTSPOTS,
} from '@blr/content';
import type { NpcDef, Station } from '@blr/content';
import type {
  CityMemory,
  Conversation,
  DialogueContext,
  DialogueOutput,
  GuideAnswer,
  GuideArea,
  MissionProgress,
  Point,
  TrafficZone,
  TransitTrip,
  WorldIndex,
} from '@blr/engine';
import {
  CLOCK_RATE,
  askGuide,
  chooseReply,
  closeConversation,
  compassDirection,
  createMemory,
  driveMinutes,
  formatDistance,
  holds,
  isRainingAt,
  missionEvent,
  missionReach,
  missionTarget,
  missionTick,
  nearestArea,
  openConversation,
  projectToLocal,
  reviveMemory,
  reviveMissions,
  startMission,
  withCoins,
  withFact,
  withItem,
  withNote,
  wrapHour,
} from '@blr/engine';
import { create } from 'zustand';
import { useUi } from './ui';

export type Mode = 'foot' | 'auto' | 'drone';
export type Panel = 'guide' | 'missions' | 'station' | null;

export type Prompt =
  | { kind: 'npc'; id: string; label: string }
  | { kind: 'station'; id: string; label: string }
  | { kind: 'auto'; id: string; label: string }
  | { kind: 'exit'; label: string };

export interface Toast {
  id: number;
  tone: 'info' | 'good' | 'bad';
  title: string;
  text: string;
}

export interface Travel {
  mode: 'auto' | 'metro' | 'bus';
  to: string;
  title: string;
  detail: string;
  minutes: number;
}

export interface Tracker {
  missionId: string;
  title: string;
  step: string;
  minutesLeft: number | null;
  /** "650 m north-east", when the step points somewhere. */
  heading: string | null;
  target: Point | null;
}

interface Save {
  v: 1;
  memory: CityMemory;
  missions: Record<string, MissionProgress>;
  day: number;
  hour: number;
}

const SAVE_KEY = 'real-bengaluru.save.v1';
const TALK_RANGE = 5;
const STATION_RANGE = 16;
const TRAVEL_SECONDS = 2.4;

const PLACE_NAMES: Readonly<Record<string, string>> = Object.fromEntries(
  ANCHORS.map((anchor) => [anchor.id, anchor.name]),
);

function loadSave(): Save | null {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<Save>;
    if (parsed.v !== 1) return null;
    return {
      v: 1,
      memory: reviveMemory(parsed.memory),
      missions: reviveMissions(parsed.missions, MISSIONS_BY_ID),
      day: typeof parsed.day === 'number' && Number.isFinite(parsed.day) ? parsed.day : 0,
      hour: typeof parsed.hour === 'number' && Number.isFinite(parsed.hour) ? parsed.hour : 8,
    };
  } catch {
    return null; // Storage can be unavailable or hold junk; start fresh.
  }
}

function writeSave(save: Save): void {
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(save));
  } catch {
    // Private windows and full disks: the game simply does not persist.
  }
}

interface CityState {
  /** True once the world index has loaded and anchors have positions. */
  ready: boolean;
  /** The baked world is the hand-drawn placeholder, not the real street map. */
  sketch: boolean;
  positions: Record<string, Point>;
  zones: TrafficZone[];
  memory: CityMemory;
  missions: Record<string, MissionProgress>;
  day: number;
  raining: boolean;
  mode: Mode;
  player: Point;
  area: GuideArea | null;
  areaInside: boolean;
  prompt: Prompt | null;
  conversation: Conversation | null;
  pendingRide: Extract<DialogueOutput, { kind: 'ride' }> | null;
  panel: Panel;
  stationId: string | null;
  guideAnswer: GuideAnswer | null;
  travel: Travel | null;
  travelLeft: number;
  /** Bumped whenever the player should be moved; the 3D view applies it. */
  warp: { x: number; z: number; seq: number } | null;
  toast: Toast | null;
  jam: string | null;
  /** Bumped by the on-screen prompt button; the 3D view treats it like pressing E. */
  interactSeq: number;
  /** Bumped by the on-screen drone button; the 3D view treats it like pressing F. */
  droneSeq: number;

  initWorld: (index: WorldIndex) => void;
  /** Called a few times a second by the 3D view with where the player is. */
  report: (x: number, z: number, nearAuto: { id: string; distance: number } | null) => void;
  /** Advances the clock, weather and mission timers by real seconds. */
  tick: (realSeconds: number) => void;
  setMode: (mode: Mode) => void;
  interact: () => void;
  requestInteract: () => void;
  requestDrone: () => void;
  reply: (index: number) => void;
  closeTalk: () => void;
  openPanel: (panel: Panel) => void;
  ask: (question: string) => void;
  beginMission: (id: string) => void;
  board: (trip: TransitTrip) => void;
  dismissToast: () => void;
  newGame: () => void;
}

const saved = typeof window === 'undefined' ? null : loadSave();
let toastId = 0;

function toast(tone: Toast['tone'], title: string, text: string): Toast {
  return { id: ++toastId, tone, title, text };
}

/** Where a character is standing right now, given what the city remembers. */
export function npcPosition(
  npc: NpcDef,
  context: DialogueContext,
  positions: Readonly<Record<string, Point>>,
): Point | null {
  const place = npc.places.find((entry) => holds(entry.when, context, npc.id));
  const at = place ? positions[place.anchor] : undefined;
  return at ? { x: at.x + npc.offset[0], z: at.z + npc.offset[1] } : null;
}

export function stationPosition(
  station: Station,
  positions: Readonly<Record<string, Point>>,
): Point | null {
  const at = positions[station.anchor];
  if (!at) return null;
  // Signs stand a little off the anchor so they do not sit on top of a character.
  return station.kind === 'metro' ? { x: at.x - 4, z: at.z - 4 } : { x: at.x + 4, z: at.z - 5 };
}

export function autoHome(id: string, positions: Readonly<Record<string, Point>>): Point | null {
  const auto = PARKED_AUTOS.find((entry) => entry.id === id);
  const at = auto ? positions[auto.anchor] : undefined;
  return auto && at ? { x: at.x + auto.offset[0], z: at.z + auto.offset[1] } : null;
}

function missionStates(missions: Readonly<Record<string, MissionProgress>>) {
  return Object.fromEntries(
    Object.values(missions).map((progress) => [
      progress.id,
      {
        status: progress.status,
        step: MISSIONS_BY_ID[progress.id]?.steps[progress.step]?.id ?? '',
      },
    ]),
  );
}

export const useCity = create<CityState>((set, get) => {
  const context = (at: Point = get().player): DialogueContext => contextOf(get(), at);

  const persist = () => {
    const state = get();
    writeSave({
      v: 1,
      memory: state.memory,
      missions: state.missions,
      day: state.day,
      hour: useUi.getState().hour,
    });
  };

  /** Applies mission results that follow from a change in progress: rewards, toasts, clean-up. */
  const settle = (
    before: Record<string, MissionProgress>,
    after: Record<string, MissionProgress>,
  ) => {
    let memory = get().memory;
    let message: Toast | null = null;
    for (const progress of Object.values(after)) {
      const def = MISSIONS_BY_ID[progress.id];
      const was = before[progress.id];
      if (!def || !was || was.status !== 'active') continue;
      if (progress.status === 'done') {
        memory = withNote(withCoins(memory, def.reward), `Done: ${def.title}.`);
        message = toast('good', `${def.title} · done`, `${def.successText} +₹${def.reward}`);
      } else if (progress.status === 'failed') {
        if (def.id === 'bisi_coffee') memory = withItem(memory, 'flask', -1);
        message = toast('bad', `${def.title} · failed`, def.failText);
      } else if (progress.step !== was.step) {
        const step = def.steps[progress.step];
        if (step) message = toast('info', def.title, step.text);
      }
    }
    set(message ? { missions: after, memory, toast: message } : { missions: after, memory });
    if (message) persist();
  };

  const raise = (name: string) => {
    const before = get().missions;
    const after: Record<string, MissionProgress> = {};
    for (const [id, progress] of Object.entries(before)) {
      const def = MISSIONS_BY_ID[id];
      after[id] = def ? missionEvent(def, progress, name) : progress;
    }
    settle(before, after);
  };

  const reach = (at: Point) => {
    const before = get().missions;
    let changed = false;
    const after: Record<string, MissionProgress> = {};
    for (const [id, progress] of Object.entries(before)) {
      const def = MISSIONS_BY_ID[id];
      const next = def ? missionReach(def, progress, at, get().positions) : progress;
      if (next !== progress) changed = true;
      after[id] = next;
    }
    if (changed) settle(before, after);
  };

  /** Moves the clock on by game minutes: day rollover, weather and mission timers. */
  const passMinutes = (minutes: number) => {
    const ui = useUi.getState();
    const raw = ui.hour + minutes / 60;
    let day = get().day;
    if (raw >= 24) day += 1;
    ui.setHour(wrapHour(raw));

    const before = get().missions;
    let changed = false;
    let touched = false;
    let forcedRain = false;
    const after: Record<string, MissionProgress> = {};
    for (const [id, progress] of Object.entries(before)) {
      const next = missionTick(progress, minutes);
      if (next !== progress) touched = true;
      if (next.status !== progress.status) changed = true;
      after[id] = next;
      if (next.status === 'active' && MISSIONS_BY_ID[id]?.rain) forcedRain = true;
    }
    const raining = forcedRain || isRainingAt(day, wrapHour(raw));
    if (changed) settle(before, after);
    else if (touched) set({ missions: after });
    if (raining !== get().raining || day !== get().day) set({ raining, day });
  };

  const handle = (outputs: readonly DialogueOutput[]) => {
    for (const output of outputs) {
      if (output.kind === 'start') get().beginMission(output.mission);
      else if (output.kind === 'event') raise(output.name);
      else set({ pendingRide: output });
    }
  };

  const startTravel = (travel: Travel) => {
    set({ travel, travelLeft: TRAVEL_SECONDS, panel: null, prompt: null });
  };

  const finishTravel = () => {
    const { travel, positions } = get();
    if (!travel) return;
    const to = positions[travel.to];
    set((state) => ({
      travel: null,
      memory: withFact(state.memory, 'commute.mode', travel.mode),
      warp: to ? { x: to.x, z: to.z + 2.5, seq: (state.warp?.seq ?? 0) + 1 } : state.warp,
      player: to ? { x: to.x, z: to.z + 2.5 } : state.player,
    }));
    passMinutes(travel.minutes);
    if (to) reach({ x: to.x, z: to.z + 2.5 });
    persist();
  };

  const afterTalk = () => {
    const ride = get().pendingRide;
    if (ride) {
      const to = get().positions[ride.to];
      const from = get().player;
      const minutes = to
        ? driveMinutes(
            Math.hypot(to.x - from.x, to.z - from.z),
            useUi.getState().hour,
            get().raining,
          )
        : 5;
      set({ pendingRide: null });
      startTravel({
        mode: 'auto',
        to: ride.to,
        title: `Auto to ${PLACE_NAMES[ride.to] ?? ride.to}`,
        detail: `${NPCS_BY_ID[ride.npcId]?.name ?? 'The driver'} is driving · ₹${ride.fare} · about ${Math.round(minutes)} min in this traffic`,
        minutes,
      });
    }
    persist();
  };

  return {
    ready: false,
    sketch: false,
    positions: {},
    zones: [],
    memory: saved?.memory ?? createMemory(),
    missions: saved?.missions ?? {},
    day: saved?.day ?? 0,
    raining: false,
    mode: 'foot',
    player: { x: 0, z: 0 },
    area: null,
    areaInside: false,
    prompt: null,
    conversation: null,
    pendingRide: null,
    panel: null,
    stationId: null,
    guideAnswer: null,
    travel: null,
    travelLeft: 0,
    warp: null,
    toast: null,
    jam: null,
    interactSeq: 0,
    droneSeq: 0,

    initWorld: (index) => {
      const positions: Record<string, Point> = {};
      for (const anchor of ANCHORS) {
        positions[anchor.id] = index.anchors?.[anchor.id] ?? projectToLocal(anchor, index.origin);
      }
      const zones: TrafficZone[] = [];
      for (const spot of TRAFFIC_HOTSPOTS) {
        const at = positions[spot.anchor];
        if (!at) continue;
        zones.push({
          x: at.x,
          z: at.z,
          radius: spot.radius,
          severity: spot.severity,
          name: PLACE_NAMES[spot.anchor] ?? spot.anchor,
        });
      }
      // Dev aid: ?at=<anchor id> starts at that anchor instead of the Majestic bus stand.
      const wanted = new URLSearchParams(window.location.search).get('at');
      const spawn = (wanted ? positions[wanted] : undefined) ?? index.spawn;
      set({
        ready: true,
        sketch: (index.stats.sketch ?? 0) > 0,
        positions,
        zones,
        player: { x: spawn.x, z: spawn.z + 3 },
        warp: { x: spawn.x, z: spawn.z + 3, seq: (get().warp?.seq ?? 0) + 1 },
      });
      if (saved) useUi.getState().setHour(saved.hour);
      passMinutes(0);
    },

    report: (x, z, nearAuto) => {
      const state = get();
      if (!state.ready) return;
      const at = { x, z };
      const found = nearestArea(GUIDE_AREAS, state.positions, x, z);

      let prompt: Prompt | null = null;
      if (state.mode === 'auto') prompt = { kind: 'exit', label: 'Get out of the auto' };
      else if (state.mode === 'foot') {
        let best = Math.min(TALK_RANGE, nearAuto?.distance ?? Infinity);
        const ctx = context(at);
        for (const npc of NPCS) {
          const where = npcPosition(npc, ctx, state.positions);
          if (!where) continue;
          const distance = Math.hypot(where.x - x, where.z - z);
          if (distance < best) {
            best = distance;
            prompt = { kind: 'npc', id: npc.id, label: `Talk to ${npc.name}` };
          }
        }
        if (!prompt && nearAuto) {
          prompt = { kind: 'auto', id: nearAuto.id, label: 'Borrow this auto' };
        }
        if (!prompt) {
          let nearest = STATION_RANGE;
          for (const station of STATIONS) {
            const where = stationPosition(station, state.positions);
            if (!where) continue;
            const distance = Math.hypot(where.x - x, where.z - z);
            if (distance < nearest) {
              nearest = distance;
              prompt = {
                kind: 'station',
                id: station.id,
                label:
                  station.kind === 'metro'
                    ? `Take the metro from ${PLACE_NAMES[station.anchor] ?? 'here'}`
                    : `Wait for a bus at ${PLACE_NAMES[station.anchor] ?? 'this stop'}`,
              };
            }
          }
        }
      }

      let jam: string | null = null;
      if (state.mode === 'auto') {
        for (const zone of state.zones) {
          if (Math.hypot(zone.x - x, zone.z - z) <= zone.radius) jam = zone.name;
        }
      }
      const same =
        state.prompt?.kind === prompt?.kind &&
        (state.prompt as { id?: string } | null)?.id === (prompt as { id?: string } | null)?.id;
      set({
        player: at,
        area: found?.area ?? null,
        areaInside: found?.inside ?? false,
        prompt: same ? state.prompt : prompt,
        jam,
      });
      reach(at);
    },

    tick: (realSeconds) => {
      const state = get();
      if (!state.ready) return;
      if (state.travel) {
        const travelLeft = state.travelLeft - realSeconds;
        if (travelLeft <= 0) finishTravel();
        else set({ travelLeft });
        return;
      }
      // The clock stands still while you are talking or reading a timetable.
      if (state.conversation || state.panel === 'station') return;
      passMinutes((realSeconds * CLOCK_RATE) / 60);
    },

    setMode: (mode) => {
      const state = get();
      if (mode === state.mode) return;
      let memory = state.memory;
      if (mode === 'auto') {
        memory = withFact(withFact(memory, 'auto.borrowed', true), 'commute.mode', 'self');
      }
      set({ mode, memory, prompt: null });
    },

    interact: () => {
      const state = get();
      const prompt = state.prompt;
      if (!prompt || state.conversation || state.travel || state.panel) return;
      if (prompt.kind === 'npc') {
        const npc = NPCS_BY_ID[prompt.id];
        if (!npc) return;
        const step = openConversation(npc, context());
        set({ memory: step.memory, conversation: step.conversation, prompt: null });
        handle(step.outputs);
      } else if (prompt.kind === 'station') {
        set({ panel: 'station', stationId: prompt.id });
      }
      // Autos are entered and left by the 3D view, which owns the vehicles.
    },

    requestInteract: () => set((state) => ({ interactSeq: state.interactSeq + 1 })),
    requestDrone: () => set((state) => ({ droneSeq: state.droneSeq + 1 })),

    reply: (index) => {
      const conversation = get().conversation;
      const npc = conversation ? NPCS_BY_ID[conversation.npcId] : undefined;
      if (!conversation || !npc) return;
      if (conversation.choices[index]?.disabled) return;
      const step = chooseReply(npc, conversation, index, context());
      set({ memory: step.memory, conversation: step.conversation });
      handle(step.outputs);
      if (!step.conversation) afterTalk();
    },

    closeTalk: () => {
      const conversation = get().conversation;
      if (!conversation) return;
      set({ memory: closeConversation(get().memory, conversation), conversation: null });
      afterTalk();
    },

    openPanel: (panel) => {
      const state = get();
      if (state.conversation || state.travel) return;
      set({
        panel: state.panel === panel ? null : panel,
        guideAnswer: panel === 'guide' ? null : state.guideAnswer,
      });
    },

    ask: (question) => {
      const state = get();
      const text = question.trim();
      if (!text) return;
      set({ guideAnswer: askGuide(text, state.area, GUIDE_AREAS, state.positions, state.player) });
    },

    beginMission: (id) => {
      const def = MISSIONS_BY_ID[id];
      if (!def || get().missions[id]?.status === 'active') return;
      if (def.startHour !== undefined) useUi.getState().setHour(def.startHour);
      set((state) => ({
        missions: { ...state.missions, [id]: startMission(def) },
        raining: def.rain ? true : state.raining,
        panel: null,
        toast: toast('info', `New: ${def.title}`, def.steps[0]?.text ?? def.brief),
      }));
      persist();
    },

    board: (trip) => {
      const state = get();
      if (trip.fare > state.memory.coins) {
        set({ toast: toast('bad', 'Not enough money', `The ticket is ₹${trip.fare}.`) });
        return;
      }
      set({ memory: withCoins(state.memory, -trip.fare) });
      const place = PLACE_NAMES[trip.to] ?? trip.to;
      startTravel({
        mode: trip.line.kind,
        to: trip.to,
        title: `${trip.line.kind === 'metro' ? 'Metro' : 'Bus'} to ${place}`,
        detail: `${trip.line.name} · ₹${trip.fare} · ${Math.round(trip.wait)} min wait, ${Math.round(trip.ride)} min ride`,
        minutes: trip.wait + trip.ride,
      });
    },

    dismissToast: () => set({ toast: null }),

    newGame: () => {
      const spawn = get().positions.majestic_bus;
      set((state) => ({
        memory: createMemory(),
        missions: {},
        day: 0,
        raining: false,
        mode: 'foot',
        conversation: null,
        pendingRide: null,
        panel: null,
        travel: null,
        guideAnswer: null,
        toast: null,
        warp: spawn ? { x: spawn.x, z: spawn.z + 3, seq: (state.warp?.seq ?? 0) + 1 } : state.warp,
      }));
      useUi.getState().setHour(8);
      persist();
    },
  };
});

/** The mission to show on the HUD: the active one with the least time left. */
export function trackerFor(
  missions: Readonly<Record<string, MissionProgress>>,
  positions: Readonly<Record<string, Point>>,
  player: Point,
): Tracker | null {
  let chosen: MissionProgress | null = null;
  for (const progress of Object.values(missions)) {
    if (progress.status !== 'active') continue;
    if (!chosen || (progress.minutesLeft ?? Infinity) < (chosen.minutesLeft ?? Infinity)) {
      chosen = progress;
    }
  }
  const def = chosen ? MISSIONS_BY_ID[chosen.id] : undefined;
  if (!chosen || !def) return null;
  const anchor = missionTarget(def, chosen);
  const target = anchor ? (positions[anchor] ?? null) : null;
  const distance = target ? Math.hypot(target.x - player.x, target.z - player.z) : 0;
  return {
    missionId: chosen.id,
    title: def.title,
    step: def.steps[chosen.step]?.text ?? '',
    minutesLeft: chosen.minutesLeft,
    heading:
      target && distance > 25
        ? `${formatDistance(distance)} ${compassDirection(player, target)}`
        : target
          ? 'Right here'
          : null,
    target,
  };
}

/** Everything a character's conditions can read, as things stand now. */
export function contextOf(state: CityState, at: Point = state.player): DialogueContext {
  return {
    memory: state.memory,
    hour: useUi.getState().hour,
    raining: state.raining,
    missions: missionStates(state.missions),
    at,
    positions: state.positions,
    placeNames: PLACE_NAMES,
  };
}

export { MISSIONS, PLACE_NAMES };
export type { CityState };
