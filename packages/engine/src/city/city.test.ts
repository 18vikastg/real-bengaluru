import { describe, expect, it } from 'vitest';
import type { DialogueContext, GuideArea, MissionDef, NpcScript, TransitLine } from '../index';
import {
  advanceHour,
  askGuide,
  chooseReply,
  compassDirection,
  congestion,
  createMemory,
  driveMinutes,
  formatClock,
  hoursUntil,
  isRainingAt,
  makeOffer,
  meterFare,
  minutesToNextDeparture,
  missionEvent,
  missionReach,
  missionTick,
  nearestArea,
  offerChoices,
  openBargain,
  openConversation,
  planTrip,
  reviveMemory,
  reviveMissions,
  speedFactor,
  startMission,
  validateScript,
  withItem,
} from '../index';

const positions = { home: { x: 0, z: 0 }, far: { x: 3000, z: 0 }, north: { x: 0, z: -500 } };

function context(overrides: Partial<DialogueContext> = {}): DialogueContext {
  return {
    memory: createMemory(),
    hour: 12,
    raining: false,
    missions: {},
    at: { x: 0, z: 0 },
    positions,
    placeNames: { far: 'Far Place' },
    ...overrides,
  };
}

describe('clock and traffic', () => {
  it('advances and wraps the clock', () => {
    expect(advanceHour(23.9, 3600, 1)).toBeCloseTo(0.9, 5);
    expect(hoursUntil(23, 1)).toBeCloseTo(2, 5);
    expect(formatClock(8.5)).toBe('08:30');
    expect(formatClock(23.999)).toBe('00:00');
  });

  it('is jammed at peak hours and clear at night', () => {
    expect(congestion(9.2)).toBeGreaterThan(0.9);
    expect(congestion(18.6)).toBeGreaterThan(0.9);
    expect(congestion(3)).toBeLessThan(0.1);
    expect(congestion(13)).toBeLessThan(0.5);
  });

  it('slows vehicles in jams and rain, within sane bounds', () => {
    const zone = { x: 0, z: 0, radius: 100, severity: 1, name: 'Junction' };
    expect(speedFactor(3, false)).toBeGreaterThan(0.95);
    expect(speedFactor(9.2, false, zone)).toBeLessThan(speedFactor(9.2, false));
    expect(speedFactor(9.2, true, zone)).toBeGreaterThanOrEqual(0.22);
    expect(driveMinutes(3700, 9, false)).toBeGreaterThan(driveMinutes(3700, 13, false) * 1.5);
    expect(driveMinutes(3700, 9, true)).toBeGreaterThan(driveMinutes(3700, 9, false));
  });

  it('rains deterministically, and only during the day’s shower', () => {
    let wet = 0;
    for (let day = 0; day < 40; day++) {
      expect(isRainingAt(day, 9)).toBe(false);
      for (let hour = 15; hour < 22; hour += 0.25) {
        if (isRainingAt(day, hour)) {
          wet++;
          break;
        }
      }
      expect(isRainingAt(day, 18)).toBe(isRainingAt(day, 18));
    }
    expect(wet).toBeGreaterThan(10);
    expect(wet).toBeLessThan(40);
  });
});

describe('bargaining', () => {
  it('charges the minimum for short hops and more for long ones', () => {
    expect(meterFare(500)).toBe(35);
    expect(meterFare(4000)).toBeGreaterThan(meterFare(2000));
  });

  it('opens above the meter, higher in rain, lower for a friend', () => {
    const plain = openBargain({ metres: 3700, hour: 13, raining: false, rapport: 0 });
    const rain = openBargain({ metres: 3700, hour: 13, raining: true, rapport: 0 });
    const friend = openBargain({ metres: 3700, hour: 13, raining: false, rapport: 3 });
    expect(plain.ask).toBeGreaterThan(plain.meter);
    expect(plain.floor).toBeGreaterThanOrEqual(plain.meter);
    expect(plain.ask).toBeGreaterThan(plain.floor);
    expect(rain.ask).toBeGreaterThan(plain.ask);
    expect(rain.excuse).toBe('rain');
    expect(friend.ask).toBeLessThan(plain.ask);
  });

  it('accepts a fair offer, counters a low one, and walks away in the end', () => {
    const bargain = openBargain({ metres: 3700, hour: 13, raining: false, rapport: 0 });
    const offers = offerChoices(bargain);
    expect(offers.low).toBeLessThan(bargain.floor);
    expect(offers.fair).toBeGreaterThanOrEqual(bargain.floor);
    expect(offers.fair).toBeLessThan(offers.full);
    expect(makeOffer(bargain, offers.full)).toEqual({
      kind: 'deal',
      fare: bargain.ask,
      mood: 'happy',
    });
    expect(makeOffer(bargain, offers.fair).kind).toBe('deal');

    let current = bargain;
    let outcome = makeOffer(current, offers.low);
    let rounds = 0;
    while (outcome.kind === 'counter') {
      expect(outcome.bargain.ask).toBeLessThanOrEqual(current.ask);
      expect(outcome.bargain.ask).toBeGreaterThanOrEqual(current.floor);
      current = outcome.bargain;
      outcome = makeOffer(current, offers.low);
      rounds++;
    }
    expect(outcome.kind).toBe('refused');
    expect(rounds).toBe(2);
  });
});

describe('transit', () => {
  const line: TransitLine = {
    id: 'l',
    name: 'Line',
    kind: 'metro',
    stops: ['a', 'b', 'c', 'd'],
    headway: 6,
    minutesPerStop: 2.5,
    firstHour: 5,
    lastHour: 23,
    baseFare: 10,
    farePerStop: 5,
  };

  it('waits at most one headway', () => {
    for (let hour = 5; hour < 23; hour += 0.07) {
      const wait = minutesToNextDeparture(line, 'b', hour);
      expect(wait).toBeGreaterThanOrEqual(0);
      expect(wait).toBeLessThan(6);
    }
  });

  it('plans trips both ways and not when closed', () => {
    const trip = planTrip(line, 'a', 'd', 8, false);
    expect(trip?.stops).toBe(3);
    expect(trip?.ride).toBeCloseTo(7.5, 5);
    expect(trip?.fare).toBe(20);
    expect(planTrip(line, 'd', 'a', 8, false)?.stops).toBe(3);
    expect(planTrip(line, 'a', 'a', 8, false)).toBeNull();
    expect(planTrip(line, 'a', 'x', 8, false)).toBeNull();
    expect(planTrip(line, 'a', 'd', 2, false)).toBeNull();
  });

  it('holds buses up in traffic but not the metro', () => {
    const bus: TransitLine = { ...line, kind: 'bus' };
    const peak = planTrip(bus, 'a', 'd', 9.2, false);
    const quiet = planTrip(bus, 'a', 'd', 13.5, false);
    expect(peak?.ride ?? 0).toBeGreaterThan((quiet?.ride ?? 0) * 1.3);
    expect(planTrip(line, 'a', 'd', 9.2, true)?.ride).toBeCloseTo(7.5, 5);
  });
});

describe('missions', () => {
  const def: MissionDef = {
    id: 'm',
    title: 'Test',
    giver: 'Nobody',
    brief: '',
    steps: [
      { id: 'talk', text: '', goal: { kind: 'event', name: 'talked' } },
      { id: 'go', text: '', goal: { kind: 'reach', anchor: 'far', radius: 30 } },
    ],
    reward: 10,
    minutes: 20,
    successText: '',
    failText: '',
  };

  it('advances on the right event and the right place only', () => {
    let progress = startMission(def);
    progress = missionReach(def, progress, { x: 3000, z: 0 }, positions);
    expect(progress.step).toBe(0);
    progress = missionEvent(def, progress, 'something_else');
    expect(progress.step).toBe(0);
    progress = missionEvent(def, progress, 'talked');
    expect(progress.step).toBe(1);
    progress = missionReach(def, progress, { x: 2900, z: 0 }, positions);
    expect(progress.status).toBe('active');
    progress = missionReach(def, progress, { x: 2990, z: 10 }, positions);
    expect(progress.status).toBe('done');
    expect(missionTick(progress, 999).status).toBe('done');
  });

  it('fails when time runs out', () => {
    let progress = startMission(def);
    progress = missionTick(progress, 19);
    expect(progress.status).toBe('active');
    expect(progress.minutesLeft).toBeCloseTo(1, 5);
    progress = missionTick(progress, 5);
    expect(progress.status).toBe('failed');
    expect(missionEvent(def, progress, 'talked').step).toBe(0);
  });

  it('revives saved progress and drops junk', () => {
    const revived = reviveMissions(
      {
        m: { id: 'm', status: 'active', step: 99, minutesLeft: 4 },
        gone: { status: 'done' },
        bad: 3,
      },
      { m: def },
    );
    expect(Object.keys(revived)).toEqual(['m']);
    expect(revived.m?.step).toBe(1);
  });
});

describe('dialogue', () => {
  const script: NpcScript = {
    id: 'seller',
    name: 'Seller',
    root: 'root',
    haggle: {
      rapportFact: 'seller.rapport',
      open: [{ text: '{place}: ₹{ask}.' }],
      rain: 'Rain.',
      night: 'Night.',
      peak: 'Peak.',
      counter: 'Last: ₹{ask}.',
      dealHappy: 'Happy ₹{fare}.',
      dealFine: 'Fine ₹{fare}.',
      dealGrumbling: 'Grumble ₹{fare}.',
      refused: 'No.',
      broke: 'You lack ₹{fare}.',
    },
    nodes: {
      root: {
        say: [
          { when: { fact: 'seller.bought' }, text: 'You again, with {coins} rupees.' },
          { when: { met: 'before' }, text: 'Back?' },
          { text: 'Hello, stranger.' },
        ],
        choices: [
          {
            text: 'Buy',
            to: 'bought',
            effects: [{ coins: -50 }, { give: 'thing' }, { set: 'seller.bought', to: true }],
          },
          { text: 'Secret', when: { item: 'thing' }, to: 'secret' },
          { text: 'Ride', ride: 'far' },
          { text: 'Bye' },
        ],
      },
      bought: {
        say: [{ text: 'Sold.' }],
        effects: [{ event: 'sale' }, { note: 'Bought a thing.' }],
        choices: [],
      },
      secret: {
        say: [{ text: 'Psst.' }],
        effects: [{ start: 'quest' }],
        choices: [{ text: 'Ok' }],
      },
    },
  };

  it('is wired soundly, and reports broken wiring', () => {
    expect(validateScript(script)).toEqual([]);
    const broken: NpcScript = {
      ...script,
      nodes: {
        ...script.nodes,
        root: { say: [{ text: 'x' }], choices: [{ text: 'go', to: 'nowhere' }] },
      },
    };
    expect(validateScript(broken).length).toBeGreaterThan(0);
  });

  it('remembers purchases and meetings across conversations', () => {
    let ctx = context();
    let step = openConversation(script, ctx);
    expect(step.conversation?.text).toBe('Hello, stranger.');
    expect(step.conversation?.choices.map((c) => c.text)).toEqual(['Buy', 'Ride', 'Bye']);

    step = chooseReply(script, step.conversation!, 0, { ...ctx, memory: step.memory });
    expect(step.conversation?.text).toBe('Sold.');
    expect(step.memory.coins).toBe(250);
    expect(step.memory.items.thing).toBe(1);
    expect(step.outputs).toEqual([{ kind: 'event', name: 'sale' }]);
    expect(step.memory.notes).toEqual(['Bought a thing.']);

    step = chooseReply(script, step.conversation!, 0, { ...ctx, memory: step.memory });
    expect(step.conversation).toBeNull();
    expect(step.memory.met.seller).toBe(1);

    ctx = context({ memory: step.memory });
    step = openConversation(script, ctx);
    expect(step.conversation?.text).toBe('You again, with 250 rupees.');
    expect(step.conversation?.choices.map((c) => c.text)).toContain('Secret');
    step = chooseReply(script, step.conversation!, 1, ctx);
    expect(step.outputs).toEqual([{ kind: 'start', mission: 'quest' }]);
  });

  it('greys out what the player cannot afford', () => {
    const poor = { ...createMemory(), coins: 10 };
    const step = openConversation(script, context({ memory: poor }));
    expect(step.conversation?.choices[0]?.disabled).toBe('Needs ₹50');
    const same = chooseReply(script, step.conversation!, 0, context({ memory: poor }));
    expect(same.memory.coins).toBe(10);
    expect(same.conversation).toBeDefined();
  });

  it('haggles to a deal, takes the fare and starts the ride', () => {
    const ctx = context();
    let step = openConversation(script, ctx);
    step = chooseReply(script, step.conversation!, 1, ctx);
    const haggle = step.conversation?.haggle;
    expect(haggle).toBeDefined();
    expect(step.conversation?.text).toContain('Far Place');
    expect(step.conversation?.choices).toHaveLength(4);

    // Lowball once, then pay what he asks.
    step = chooseReply(script, step.conversation!, 0, { ...ctx, memory: step.memory });
    expect(step.conversation?.haggle?.bargain.ask).toBeLessThan(haggle!.bargain.ask);
    const ask = step.conversation!.haggle!.bargain.ask;
    step = chooseReply(script, step.conversation!, 2, { ...ctx, memory: step.memory });
    expect(step.outputs).toEqual([{ kind: 'ride', to: 'far', fare: ask, npcId: 'seller' }]);
    expect(step.memory.coins).toBe(300 - ask);
    expect(step.conversation?.closing).toBe(true);
    step = chooseReply(script, step.conversation!, 0, { ...ctx, memory: step.memory });
    expect(step.conversation).toBeNull();
    expect(step.memory.met.seller).toBe(1);
  });

  it('sours the driver on a player who lowballs him out of patience', () => {
    const ctx = context();
    let step = openConversation(script, ctx);
    step = chooseReply(script, step.conversation!, 1, ctx);
    for (let i = 0; i < 3 && step.conversation?.haggle; i++) {
      step = chooseReply(script, step.conversation!, 0, { ...ctx, memory: step.memory });
    }
    expect(step.conversation?.text).toBe('No.');
    expect(step.memory.facts['seller.rapport']).toBe(-1);
    expect(step.memory.coins).toBe(300);
  });
});

describe('guide', () => {
  const areas: GuideArea[] = [
    {
      id: 'home',
      name: 'Home Town',
      aliases: ['hometown'],
      anchor: 'home',
      radius: 200,
      metro: 'home',
      blurb: 'Where you start.',
      topics: [
        {
          id: 'eat',
          question: 'Where do I eat?',
          keywords: ['eat', 'food', 'hungry'],
          answer: 'At the corner.',
        },
        { id: 'old', question: 'How old is it?', keywords: ['old', 'history'], answer: 'Very.' },
      ],
    },
    {
      id: 'far',
      name: 'Far Place',
      aliases: ['the far end'],
      anchor: 'far',
      radius: 200,
      metro: 'far',
      blurb: 'A long way off.',
      topics: [
        { id: 'eat', question: 'Food there?', keywords: ['eat', 'food'], answer: 'Far food.' },
      ],
    },
  ];

  it('finds the area you are in', () => {
    expect(nearestArea(areas, positions, 50, 50)?.area.id).toBe('home');
    expect(nearestArea(areas, positions, 50, 50)?.inside).toBe(true);
    expect(nearestArea(areas, positions, 1400, 0)?.inside).toBe(false);
    expect(nearestArea(areas, positions, 2000, 0)?.area.id).toBe('far');
  });

  it('knows its compass', () => {
    expect(compassDirection({ x: 0, z: 0 }, { x: 0, z: -10 })).toBe('north');
    expect(compassDirection({ x: 0, z: 0 }, { x: 10, z: 0 })).toBe('east');
    expect(compassDirection({ x: 0, z: 0 }, { x: -10, z: 10 })).toBe('south-west');
  });

  it('answers local questions, directions and admits what it does not know', () => {
    const here = areas[0]!;
    const from = { x: 0, z: 0 };
    expect(askGuide('I am hungry', here, areas, positions, from).text).toBe('At the corner.');
    expect(askGuide('what food is in Far Place?', here, areas, positions, from).text).toBe(
      'Far food.',
    );
    const route = askGuide('How do I get to the far end?', here, areas, positions, from);
    expect(route.kind).toBe('directions');
    expect(route.text).toContain('3.0 km to the east');
    expect(route.text).toContain('metro');
    const unknown = askGuide('what is the meaning of life', here, areas, positions, from);
    expect(unknown.kind).toBe('unknown');
    expect(unknown.suggestions).toContain('Where do I eat?');
  });
});

describe('memory', () => {
  it('revives saves and ignores rubbish', () => {
    expect(reviveMemory(null).coins).toBe(300);
    const revived = reviveMemory({
      coins: 42.4,
      facts: { a: true, b: 'x', c: { nested: 1 } },
      met: { n: 2, bad: -1 },
      items: { flask: 1, none: 0 },
      notes: ['one', 5],
    });
    expect(revived).toEqual({
      coins: 42,
      facts: { a: true, b: 'x' },
      met: { n: 2 },
      items: { flask: 1 },
      notes: ['one'],
    });
    expect(withItem(withItem(createMemory(), 'x', 1), 'x', -1).items).toEqual({});
  });
});
