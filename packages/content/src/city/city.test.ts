import type { DialogueContext, MissionProgress } from '@blr/engine';
import {
  chooseReply,
  closeConversation,
  createMemory,
  driveMinutes,
  missionEvent,
  missionReach,
  missionTick,
  openConversation,
  planTrip,
  projectToLocal,
  startMission,
  validateScript,
} from '@blr/engine';
import { describe, expect, it } from 'vitest';
import {
  ANCHORS,
  GUIDE_AREAS,
  MISSIONS,
  MISSIONS_BY_ID,
  NPCS,
  NPCS_BY_ID,
  STATIONS,
  TRANSIT_LINES,
} from './index';

const anchorIds = new Set<string>(ANCHORS.map((anchor) => anchor.id));
const origin = { lat: 12.974, lon: 77.5935 };
const positions = Object.fromEntries(
  ANCHORS.map((anchor) => [anchor.id, projectToLocal(anchor, origin)]),
);
const placeNames = Object.fromEntries(ANCHORS.map((anchor) => [anchor.id, anchor.name]));

/** Every `mission` and `start`/`event` reference in a script, found by walking its JSON. */
function references(
  value: unknown,
  out = { missions: new Set<string>(), events: new Set<string>() },
) {
  if (Array.isArray(value)) value.forEach((entry) => references(entry, out));
  else if (typeof value === 'object' && value !== null) {
    const record = value as Record<string, unknown>;
    if (typeof record.mission === 'string') out.missions.add(record.mission);
    if (typeof record.start === 'string') out.missions.add(record.start);
    if (typeof record.event === 'string') out.events.add(record.event);
    Object.values(record).forEach((entry) => references(entry, out));
  }
  return out;
}

describe('anchors', () => {
  it('have unique ids and sit inside the play area', () => {
    expect(anchorIds.size).toBe(ANCHORS.length);
    for (const anchor of ANCHORS) {
      expect(anchor.lat).toBeGreaterThan(12.96);
      expect(anchor.lat).toBeLessThan(12.988);
      expect(anchor.lon).toBeGreaterThan(77.565);
      expect(anchor.lon).toBeLessThan(77.622);
    }
  });
});

describe('characters', () => {
  it('have sound dialogue graphs', () => {
    for (const npc of NPCS) expect(validateScript(npc)).toEqual([]);
  });

  it('stand at real anchors and only offer rides to real anchors', () => {
    for (const npc of NPCS) {
      expect(npc.places.length).toBeGreaterThan(0);
      expect(npc.places[npc.places.length - 1]?.when).toBeUndefined();
      for (const place of npc.places) expect(anchorIds.has(place.anchor)).toBe(true);
      for (const node of Object.values(npc.nodes)) {
        for (const choice of node.choices) {
          if (choice.ride) expect(anchorIds.has(choice.ride)).toBe(true);
        }
      }
    }
  });

  it('only mention missions and events that exist', () => {
    const wanted = new Set<string>();
    for (const mission of MISSIONS) {
      for (const step of mission.steps) if (step.goal.kind === 'event') wanted.add(step.goal.name);
    }
    const raised = new Set<string>();
    for (const npc of NPCS) {
      const found = references(npc.nodes);
      for (const id of found.missions) expect(Object.keys(MISSIONS_BY_ID)).toContain(id);
      for (const event of found.events) {
        expect([...wanted]).toContain(event);
        raised.add(event);
      }
    }
    // Every event a mission waits for can actually be raised by somebody.
    for (const event of wanted) expect([...raised]).toContain(event);
  });

  it('never use the internal codename', () => {
    expect(JSON.stringify(NPCS).toLowerCase()).not.toContain('gta');
  });
});

describe('missions and transit', () => {
  it('point at real anchors', () => {
    for (const mission of MISSIONS) {
      expect(mission.steps.length).toBeGreaterThan(0);
      for (const step of mission.steps) {
        if (step.goal.kind === 'reach') expect(anchorIds.has(step.goal.anchor)).toBe(true);
      }
    }
    for (const line of TRANSIT_LINES) {
      expect(line.stops.length).toBeGreaterThan(1);
      for (const stop of line.stops) expect(anchorIds.has(stop)).toBe(true);
    }
    expect(STATIONS.length).toBeGreaterThan(8);
  });

  it('first day: the metro makes it comfortably, an auto at peak hour only just', () => {
    const mission = MISSIONS_BY_ID.first_day!;
    const metro = planTrip(
      TRANSIT_LINES[0]!,
      'majestic_metro',
      'mg_road_metro',
      mission.startHour!,
      false,
    );
    expect(metro).not.toBeNull();
    // Walk to the station, wait, ride, walk out: well inside the limit.
    expect(6 + metro!.wait + metro!.ride + 3).toBeLessThan(mission.minutes! - 10);
    const from = positions.majestic_auto!;
    const to = positions.mg_road_auto!;
    const drive = driveMinutes(Math.hypot(to.x - from.x, to.z - from.z), mission.startHour!, false);
    expect(drive).toBeGreaterThan(metro!.ride);
    expect(drive + 8).toBeLessThan(mission.minutes!);
  });

  it('seven o’clock bus: possible by metro in the rain', () => {
    const mission = MISSIONS_BY_ID.night_bus!;
    const metro = planTrip(
      TRANSIT_LINES[0]!,
      'mg_road_metro',
      'majestic_metro',
      mission.startHour!,
      true,
    );
    expect(6 + metro!.wait + metro!.ride + 6).toBeLessThan(mission.minutes!);
  });
});

describe('guide', () => {
  it('areas are anchored, described and have questions', () => {
    const ids = new Set(GUIDE_AREAS.map((area) => area.id));
    expect(ids.size).toBe(GUIDE_AREAS.length);
    for (const area of GUIDE_AREAS) {
      expect(anchorIds.has(area.anchor)).toBe(true);
      if (area.metro) expect(anchorIds.has(area.metro)).toBe(true);
      expect(area.blurb.length).toBeGreaterThan(20);
      expect(area.topics.length).toBeGreaterThan(0);
      for (const topic of area.topics) {
        expect(topic.keywords.length).toBeGreaterThan(0);
        for (const keyword of topic.keywords) expect(keyword).toBe(keyword.toLowerCase());
        expect(topic.answer.length).toBeGreaterThan(30);
      }
    }
  });
});

describe('a playthrough', () => {
  /** A tiny game loop: talks to characters by picking replies by their text. */
  function play() {
    let memory = createMemory();
    const missions: Record<string, MissionProgress> = {};
    let hour = 12;
    const context = (npcId: string): DialogueContext => {
      const npc = NPCS_BY_ID[npcId]!;
      const base: DialogueContext = {
        memory,
        hour,
        raining: false,
        missions: {},
        at: { x: 0, z: 0 },
        positions,
        placeNames,
      };
      const state = Object.fromEntries(
        Object.values(missions).map((progress) => [
          progress.id,
          {
            status: progress.status,
            step: MISSIONS_BY_ID[progress.id]!.steps[progress.step]!.id,
          },
        ]),
      );
      const place = npc.places.find((entry) => !entry.when) ?? npc.places[0]!;
      return { ...base, missions: state, at: positions[place.anchor]! };
    };
    const rides: string[] = [];
    function talk(npcId: string, ...replies: string[]): string[] {
      const npc = NPCS_BY_ID[npcId]!;
      const heard: string[] = [];
      let step = openConversation(npc, context(npcId));
      memory = step.memory;
      for (const reply of replies) {
        const conversation = step.conversation;
        if (!conversation) throw new Error(`${npcId}: conversation ended before "${reply}"`);
        heard.push(conversation.text);
        const index = conversation.choices.findIndex((choice) => choice.text.startsWith(reply));
        if (index < 0) {
          throw new Error(
            `${npcId}: no reply starting "${reply}" among ${JSON.stringify(conversation.choices.map((c) => c.text))}`,
          );
        }
        step = chooseReply(npc, conversation, index, context(npcId));
        memory = step.memory;
        for (const output of step.outputs) {
          if (output.kind === 'start')
            missions[output.mission] = startMission(MISSIONS_BY_ID[output.mission]!);
          else if (output.kind === 'ride') rides.push(output.to);
          else {
            for (const [id, progress] of Object.entries(missions)) {
              missions[id] = missionEvent(MISSIONS_BY_ID[id]!, progress, output.name);
            }
          }
        }
      }
      if (step.conversation) {
        heard.push(step.conversation.text);
        memory = closeConversation(memory, step.conversation);
      }
      return heard;
    }
    return {
      talk,
      missions,
      rides,
      get memory() {
        return memory;
      },
      setHour(value: number) {
        hour = value;
      },
    };
  }

  it('Karthik remembers good directions and pays the favour back', () => {
    const game = play();
    game.talk('karthik', 'No idea');
    expect(game.missions.right_train?.status).toBe('active');
    expect(game.talk('karthik')[0]).toContain('conductor');
    game.talk('basava', 'How does someone get to Silk Board');
    expect(game.missions.right_train?.step).toBe(1);
    game.talk('karthik', 'Conductor says');
    expect(game.missions.right_train?.status).toBe('done');
    expect(game.memory.facts['karthik.told']).toBe('right');

    const before = game.memory.coins;
    const heard = game.talk('karthik', 'Congratulations', 'When is your bus home?', 'Let’s go');
    expect(heard[0]).toContain('I got the offer');
    expect(game.memory.coins).toBe(before + 200);
    expect(game.missions.night_bus?.status).toBe('active');
    expect(game.talk('karthik')[0]).toContain('Seven o’clock');
  });

  it('Karthik remembers bad directions too, until you make it right', () => {
    const game = play();
    game.talk('karthik', 'Just take any bus');
    expect(game.talk('karthik')[0]).toContain('Whitefield');
    game.talk('karthik', 'In my defence');
    expect(game.talk('karthik')[0]).toContain('says nothing');
    game.talk('karthik', 'Okay, okay');
    expect(game.memory.facts['karthik.forgiven']).toBe(true);
    expect(game.talk('karthik')[0]).toContain('My Majestic friend');
  });

  it('Shanthakka remembers your order, and the jasmine', () => {
    const game = play();
    game.setHour(8);
    expect(game.talk('shantha', 'Masala dose', 'Sakkath')[0]).toContain('Tindi aytha');
    expect(game.memory.coins).toBe(210);
    expect(game.talk('shantha')[0]).toContain('Same aa? Masala dose');

    game.talk('shantha', 'Any work going', 'Kodi, Akka');
    expect(game.memory.items.flask).toBe(1);
    expect(game.missions.bisi_coffee?.status).toBe('active');
    game.talk('ravi', 'Coffee from Shanthakka');
    expect(game.missions.bisi_coffee?.status).toBe('done');
    expect(game.memory.items.flask).toBeUndefined();

    game.talk('shantha', 'Anything else', 'One mola');
    game.talk('lakshmi', 'Shanthakka from the darshini', 'Twenty?', 'Twenty-five');
    expect(game.memory.items.jasmine).toBe(1);
    expect(game.missions.mallige?.step).toBe(1);
    game.talk('shantha', 'I got your mallige');
    expect(game.missions.mallige?.status).toBe('done');
    const coins = game.memory.coins;
    expect(game.talk('shantha', 'Just a coffee, Akka')[0]).toContain('mallige friend');
    expect(game.memory.coins).toBe(coins);
  });

  it('Manju remembers how you haggle', () => {
    const game = play();
    game.talk('manju', 'MG Road.', '₹', '₹', '₹');
    expect(game.rides).toEqual([]);
    expect(game.memory.facts['manju.rapport']).toBe(-1);
    // He has less patience with someone he remembers badly.
    game.talk('manju', 'MG Road.', '₹', '₹');
    expect(game.memory.facts['manju.rapport']).toBe(-2);
    expect(game.talk('manju')[0]).toContain('argue maadidri');

    const friendly = play();
    for (let i = 0; i < 2; i++) friendly.talk('manju', 'MG Road.', 'Fine, ₹');
    expect(friendly.rides).toEqual(['mg_road_auto', 'mg_road_auto']);
    expect(friendly.talk('manju')[0]).toContain('regular customer');
  });

  it('the coffee goes cold if you dawdle', () => {
    const mission = MISSIONS_BY_ID.bisi_coffee!;
    let progress = startMission(mission);
    progress = missionTick(progress, mission.minutes! + 1);
    expect(progress.status).toBe('failed');
    const office = MISSIONS_BY_ID.first_day!;
    const arrived = missionReach(office, startMission(office), positions.mg_road_metro!, positions);
    expect(arrived.status).toBe('done');
  });
});
