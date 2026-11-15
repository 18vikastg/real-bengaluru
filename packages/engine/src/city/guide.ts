/**
 * "Ask the city": a scripted local guide. It knows a set of areas, each with
 * a handful of topics, and answers a typed question by matching its words
 * against those topics. It can also give directions between areas.
 */
export interface GuideTopic {
  id: string;
  /** The question as offered on a button. */
  question: string;
  /** Lower-case words that suggest this topic. */
  keywords: readonly string[];
  answer: string;
}

export interface GuideArea {
  id: string;
  name: string;
  /** Other names people use for the place, lower case. */
  aliases: readonly string[];
  anchor: string;
  /** Metres from the anchor that still count as being "in" the area. */
  radius: number;
  blurb: string;
  topics: readonly GuideTopic[];
  /** Anchor of the nearest metro station, if one is walkable. */
  metro?: string;
}

export interface Point {
  x: number;
  z: number;
}

export interface GuideAnswer {
  kind: 'topic' | 'directions' | 'unknown';
  areaId: string | null;
  title: string;
  text: string;
  /** Follow-up questions worth offering. */
  suggestions: readonly string[];
}

/** The area whose centre is nearest, with whether the point is actually inside it. */
export function nearestArea(
  areas: readonly GuideArea[],
  positions: Readonly<Record<string, Point>>,
  x: number,
  z: number,
): { area: GuideArea; distance: number; inside: boolean } | null {
  let best: { area: GuideArea; distance: number; inside: boolean } | null = null;
  for (const area of areas) {
    const at = positions[area.anchor];
    if (!at) continue;
    const distance = Math.hypot(at.x - x, at.z - z);
    // Prefer areas the point is inside; among those (or among none), the nearest.
    const inside = distance <= area.radius;
    if (!best || (inside && !best.inside) || (inside === best.inside && distance < best.distance)) {
      best = { area, distance, inside };
    }
  }
  return best;
}

const COMPASS = [
  'north',
  'north-east',
  'east',
  'south-east',
  'south',
  'south-west',
  'west',
  'north-west',
] as const;

/** Compass direction from one point to another (+x is east, +z is south). */
export function compassDirection(from: Point, to: Point): (typeof COMPASS)[number] {
  const angle = Math.atan2(to.x - from.x, -(to.z - from.z)); // 0 = north, clockwise
  const index = ((Math.round(angle / (Math.PI / 4)) % 8) + 8) % 8;
  return COMPASS[index] as (typeof COMPASS)[number];
}

export function formatDistance(metres: number): string {
  if (metres < 950) return `${Math.max(50, Math.round(metres / 50) * 50)} m`;
  return `${(metres / 1000).toFixed(1)} km`;
}

function words(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

const DIRECTION_WORDS = [
  'how do i get',
  'how to get',
  'how to reach',
  'how do i reach',
  'how to go',
  'how do i go',
  'way to',
  'directions',
  'route to',
  'take me to',
  'where is',
  'how far',
];

function mentionedArea(areas: readonly GuideArea[], question: string): GuideArea | null {
  const text = ` ${words(question).join(' ')} `;
  let best: { area: GuideArea; length: number } | null = null;
  for (const area of areas) {
    for (const name of [area.name.toLowerCase(), ...area.aliases]) {
      const needle = ` ${words(name).join(' ')} `;
      if (needle.trim() && text.includes(needle) && (!best || needle.length > best.length)) {
        best = { area, length: needle.length };
      }
    }
  }
  return best?.area ?? null;
}

export function directionsTo(
  target: GuideArea,
  here: GuideArea | null,
  positions: Readonly<Record<string, Point>>,
  from: Point,
): string {
  const to = positions[target.anchor];
  if (!to) return `${target.name} is not on my map yet.`;
  const distance = Math.hypot(to.x - from.x, to.z - from.z);
  if (distance <= target.radius * 0.6) return `You are standing in it. This is ${target.name}.`;
  const where = `${target.name} is about ${formatDistance(distance)} to the ${compassDirection(from, to)}.`;
  if (distance < 700) return `${where} Walk it; you will be there before an auto finishes arguing.`;
  if (here?.metro && target.metro && here.metro !== target.metro) {
    return `${where} Quickest is the metro: there are stations near both ends, and the train does not sit in traffic.`;
  }
  if (target.metro && distance > 1500) {
    return `${where} There is a metro station near ${target.name}, but none close to here, so take an auto or a bus. Fix the fare before you sit.`;
  }
  return `${where} Too far to enjoy on foot. Take an auto and agree the fare first, or borrow one if you are feeling brave.`;
}

/**
 * Answers a free-typed question. `here` is the area the player is in (or
 * nearest to); topics from it win ties over topics from elsewhere.
 */
export function askGuide(
  question: string,
  here: GuideArea | null,
  areas: readonly GuideArea[],
  positions: Readonly<Record<string, Point>>,
  from: Point,
): GuideAnswer {
  const text = question.toLowerCase();
  const tokens = new Set(words(question));
  const suggestions = (area: GuideArea | null) => (area ? area.topics.map((t) => t.question) : []);

  const target = mentionedArea(areas, question);
  if (target && target.id !== here?.id && DIRECTION_WORDS.some((phrase) => text.includes(phrase))) {
    return {
      kind: 'directions',
      areaId: target.id,
      title: `Getting to ${target.name}`,
      text: directionsTo(target, here, positions, from),
      suggestions: suggestions(target),
    };
  }

  let best: { area: GuideArea; topic: GuideTopic; score: number } | null = null;
  // If the question names another area, look there; otherwise look here first, then everywhere.
  const pool = target ? [target] : here ? [here, ...areas.filter((a) => a.id !== here.id)] : areas;
  for (const area of pool) {
    for (const topic of area.topics) {
      let score = 0;
      for (const keyword of topic.keywords) {
        if (keyword.includes(' ') ? text.includes(keyword) : tokens.has(keyword)) score += 1;
      }
      if (score === 0) continue;
      if (area.id === here?.id || area.id === target?.id) score += 0.5;
      if (!best || score > best.score) best = { area, topic, score };
    }
  }
  if (best) {
    return {
      kind: 'topic',
      areaId: best.area.id,
      title:
        best.area.id === here?.id
          ? best.topic.question
          : `${best.area.name}: ${best.topic.question}`,
      text: best.topic.answer,
      suggestions: suggestions(best.area).filter((q) => q !== best.topic.question),
    };
  }

  if (target) {
    return {
      kind: 'topic',
      areaId: target.id,
      title: target.name,
      text: target.blurb,
      suggestions: suggestions(target),
    };
  }
  const area = here;
  return {
    kind: 'unknown',
    areaId: area?.id ?? null,
    title: 'That one I do not know',
    text: area
      ? `I only know what I have been told about ${area.name} and the places around it. Try one of these, or ask how to get somewhere.`
      : 'I only know the stretch from Majestic to MG Road so far. Ask me how to get to a place by name.',
    suggestions: suggestions(area),
  };
}
