/**
 * Scripted conversations. A character is a graph of nodes; each node has a
 * few variants of what the character says (the first whose condition holds
 * is spoken) and the replies the player can pick. Conditions read the
 * city's memory, the clock, the weather and mission state, which is how a
 * character "remembers" the player and reacts to the world. Effects write
 * back to memory or raise outputs (start a mission, raise an event, begin a
 * ride) for the game to act on.
 */
import type { Bargain } from './bargain';
import { makeOffer, offerChoices, openBargain, rapportChange } from './bargain';
import type { Point } from './guide';
import type { CityMemory, Fact } from './memory';
import {
  factNumber,
  hasItem,
  withCoins,
  withFact,
  withItem,
  withMeeting,
  withNote,
} from './memory';
import type { MissionStatus } from './missions';
import { formatClock, wrapHour } from './world';

export type Condition =
  | { fact: string; equals?: Fact; atLeast?: number; below?: number }
  | { not: Condition }
  | { all: readonly Condition[] }
  | { any: readonly Condition[] }
  | { met: 'never' | 'before' }
  | { hours: readonly [number, number] }
  | { raining: boolean }
  | { mission: string; is: MissionStatus | 'none'; step?: string }
  | { coins: number }
  | { item: string };

export type Effect =
  | { set: string; to: Fact }
  | { add: string; by: number }
  | { coins: number }
  | { give: string; count?: number }
  | { take: string; count?: number }
  | { note: string }
  | { start: string }
  | { event: string };

export interface Variant {
  when?: Condition;
  text: string;
}

export interface DialogueChoice {
  text: string;
  when?: Condition;
  /** Node to go to next. Leave out to end the conversation. */
  to?: string;
  effects?: readonly Effect[];
  /** Starts haggling over a ride to this anchor instead of going to a node. */
  ride?: string;
}

export interface DialogueNode {
  say: readonly Variant[];
  effects?: readonly Effect[];
  choices: readonly DialogueChoice[];
}

/** Lines a driver uses while haggling. Tokens: {ask} {meter} {fare} {place}. */
export interface HaggleLines {
  open: readonly Variant[];
  rain: string;
  night: string;
  peak: string;
  counter: string;
  dealHappy: string;
  dealFine: string;
  dealGrumbling: string;
  refused: string;
  broke: string;
  /** Fact that holds this driver's opinion of the player. */
  rapportFact: string;
}

export interface NpcScript {
  id: string;
  name: string;
  root: string;
  nodes: Readonly<Record<string, DialogueNode>>;
  haggle?: HaggleLines;
}

export interface DialogueContext {
  memory: CityMemory;
  hour: number;
  raining: boolean;
  missions: Readonly<Record<string, { status: MissionStatus; step: string }>>;
  /** Where the conversation is happening and where every anchor is. */
  at: Point;
  positions: Readonly<Record<string, Point>>;
  /** Display names of anchors, for {place}. */
  placeNames: Readonly<Record<string, string>>;
}

export type DialogueOutput =
  | { kind: 'start'; mission: string }
  | { kind: 'event'; name: string }
  | { kind: 'ride'; to: string; fare: number; npcId: string };

export interface ConversationChoice {
  text: string;
  /** Greyed out, with the reason, when the player cannot pick it. */
  disabled?: string;
}

export interface Conversation {
  npcId: string;
  nodeId: string;
  text: string;
  choices: readonly ConversationChoice[];
  /** Present while haggling. */
  haggle?: { bargain: Bargain; to: string; lowballs: number };
  /** The character has had the last word; any reply ends the conversation. */
  closing?: boolean;
}

export interface DialogueStep {
  memory: CityMemory;
  /** Null when the conversation is over. */
  conversation: Conversation | null;
  outputs: readonly DialogueOutput[];
}

export function holds(
  condition: Condition | undefined,
  context: DialogueContext,
  npcId: string,
): boolean {
  if (!condition) return true;
  if ('not' in condition) return !holds(condition.not, context, npcId);
  if ('all' in condition) return condition.all.every((c) => holds(c, context, npcId));
  if ('any' in condition) return condition.any.some((c) => holds(c, context, npcId));
  if ('met' in condition) {
    const before = (context.memory.met[npcId] ?? 0) > 0;
    return condition.met === 'before' ? before : !before;
  }
  if ('hours' in condition) {
    const [from, to] = condition.hours;
    const h = wrapHour(context.hour);
    return from <= to ? h >= from && h < to : h >= from || h < to;
  }
  if ('raining' in condition) return context.raining === condition.raining;
  if ('mission' in condition) {
    const state = context.missions[condition.mission];
    if (condition.is === 'none') return !state;
    if (!state || state.status !== condition.is) return false;
    return condition.step === undefined || state.step === condition.step;
  }
  if ('coins' in condition) return context.memory.coins >= condition.coins;
  if ('item' in condition) return hasItem(context.memory, condition.item);
  const value = context.memory.facts[condition.fact];
  if (condition.equals !== undefined) return value === condition.equals;
  if (condition.atLeast !== undefined || condition.below !== undefined) {
    const n = factNumber(context.memory, condition.fact);
    return (
      (condition.atLeast === undefined || n >= condition.atLeast) &&
      (condition.below === undefined || n < condition.below)
    );
  }
  return Boolean(value);
}

function applyEffects(
  effects: readonly Effect[] | undefined,
  memory: CityMemory,
  outputs: DialogueOutput[],
): CityMemory {
  let next = memory;
  for (const effect of effects ?? []) {
    if ('set' in effect) next = withFact(next, effect.set, effect.to);
    else if ('add' in effect)
      next = withFact(next, effect.add, factNumber(next, effect.add) + effect.by);
    else if ('coins' in effect) next = withCoins(next, effect.coins);
    else if ('give' in effect) next = withItem(next, effect.give, effect.count ?? 1);
    else if ('take' in effect) next = withItem(next, effect.take, -(effect.count ?? 1));
    else if ('note' in effect) next = withNote(next, effect.note);
    else if ('start' in effect) outputs.push({ kind: 'start', mission: effect.start });
    else outputs.push({ kind: 'event', name: effect.event });
  }
  return next;
}

function fill(text: string, tokens: Readonly<Record<string, string | number>>): string {
  return text.replace(/\{(\w+)\}/g, (whole, key: string) =>
    key in tokens ? String(tokens[key]) : whole,
  );
}

function tokensFor(context: DialogueContext, npcId: string): Record<string, string | number> {
  return {
    coins: context.memory.coins,
    time: formatClock(context.hour),
    visits: context.memory.met[npcId] ?? 0,
  };
}

function pick(variants: readonly Variant[], context: DialogueContext, npcId: string): string {
  return variants.find((variant) => holds(variant.when, context, npcId))?.text ?? '…';
}

/** A negative coin effect the player cannot cover makes the choice unavailable. */
function costOf(choice: DialogueChoice): number {
  let cost = 0;
  for (const effect of choice.effects ?? []) {
    if ('coins' in effect && effect.coins < 0) cost -= effect.coins;
  }
  return cost;
}

function visibleChoices(
  node: DialogueNode,
  context: DialogueContext,
  npcId: string,
): DialogueChoice[] {
  return node.choices.filter((choice) => holds(choice.when, context, npcId));
}

function enter(
  script: NpcScript,
  nodeId: string,
  context: DialogueContext,
  outputs: DialogueOutput[],
): DialogueStep {
  const node = script.nodes[nodeId];
  if (!node) throw new Error(`${script.id}: no dialogue node "${nodeId}"`);
  // What is said is decided before the node's own effects land, so a node can
  // say "first time?" and then record the visit.
  const text = fill(pick(node.say, context, script.id), tokensFor(context, script.id));
  const memory = applyEffects(node.effects, context.memory, outputs);
  const after = { ...context, memory };
  const choices = visibleChoices(node, after, script.id).map((choice): ConversationChoice => {
    const cost = costOf(choice);
    return cost > memory.coins
      ? { text: choice.text, disabled: `Needs ₹${cost}` }
      : { text: choice.text };
  });
  return {
    memory,
    conversation: {
      npcId: script.id,
      nodeId,
      text,
      choices: choices.length > 0 ? choices : [{ text: 'Okay.' }],
    },
    outputs,
  };
}

/** Starts talking to a character. */
export function openConversation(script: NpcScript, context: DialogueContext): DialogueStep {
  return enter(script, script.root, context, []);
}

/** Ends a conversation (walked away, or reached the end) and records the meeting. */
export function closeConversation(memory: CityMemory, conversation: Conversation): CityMemory {
  return withMeeting(memory, conversation.npcId);
}

function haggleStep(
  script: NpcScript,
  conversation: Conversation,
  index: number,
  context: DialogueContext,
): DialogueStep {
  const lines = script.haggle;
  const state = conversation.haggle;
  if (!lines || !state) throw new Error(`${script.id}: not haggling`);
  const { bargain, to } = state;
  const offers = offerChoices(bargain);
  const place = context.placeNames[to] ?? to;
  const tokens = { ask: bargain.ask, meter: bargain.meter, place };
  const end = (memory: CityMemory, outputs: DialogueOutput[] = []): DialogueStep => ({
    memory: closeConversation(memory, conversation),
    conversation: null,
    outputs,
  });
  const say = (
    text: string,
    memory: CityMemory,
    extra: Record<string, number> = {},
  ): DialogueStep => ({
    memory,
    conversation: {
      npcId: script.id,
      nodeId: conversation.nodeId,
      text: fill(text, { ...tokens, ...extra }),
      choices: [{ text: 'Okay.' }],
      closing: true,
    },
    outputs: [],
  });

  const offer = [offers.low, offers.fair, offers.full][index];
  if (offer === undefined) return end(context.memory); // "Leave it."
  if (offer > context.memory.coins) return say(lines.broke, context.memory, { fare: offer });

  const lowballs = state.lowballs + (offer < bargain.floor ? 1 : 0);
  const outcome = makeOffer(bargain, offer);
  const rapport = factNumber(context.memory, lines.rapportFact);
  const remember = (memory: CityMemory) =>
    withFact(
      memory,
      lines.rapportFact,
      Math.max(-3, Math.min(3, rapport + rapportChange(outcome, lowballs))),
    );

  if (outcome.kind === 'refused') return say(lines.refused, remember(context.memory));
  if (outcome.kind === 'counter') {
    const next = offerChoices(outcome.bargain);
    return {
      memory: context.memory,
      conversation: {
        npcId: script.id,
        nodeId: conversation.nodeId,
        text: fill(lines.counter, { ...tokens, ask: outcome.bargain.ask }),
        choices: haggleChoices(next, context.memory.coins),
        haggle: { bargain: outcome.bargain, to, lowballs },
      },
      outputs: [],
    };
  }
  const line =
    outcome.mood === 'happy'
      ? lines.dealHappy
      : outcome.mood === 'fine'
        ? lines.dealFine
        : lines.dealGrumbling;
  const paid = withCoins(remember(context.memory), -outcome.fare);
  const step = say(line, paid, { fare: outcome.fare });
  return {
    ...step,
    outputs: [{ kind: 'ride', to, fare: outcome.fare, npcId: script.id }],
  };
}

function haggleChoices(
  offers: { low: number; fair: number; full: number },
  coins: number,
): ConversationChoice[] {
  const option = (text: string, amount: number): ConversationChoice =>
    amount > coins ? { text, disabled: `You have ₹${coins}` } : { text };
  return [
    option(`₹${offers.low}. Not a rupee more.`, offers.low),
    option(`₹${offers.fair}, and we both go home happy.`, offers.fair),
    option(`Fine, ₹${offers.full}.`, offers.full),
    { text: 'Leave it, I will walk.' },
  ];
}

/** The player picks reply number `index` (as listed in `conversation.choices`). */
export function chooseReply(
  script: NpcScript,
  conversation: Conversation,
  index: number,
  context: DialogueContext,
): DialogueStep {
  if (conversation.closing) {
    return {
      memory: closeConversation(context.memory, conversation),
      conversation: null,
      outputs: [],
    };
  }
  if (conversation.haggle) return haggleStep(script, conversation, index, context);

  const node = script.nodes[conversation.nodeId];
  const choice = node ? visibleChoices(node, context, script.id)[index] : undefined;
  const finish = (memory: CityMemory, outputs: DialogueOutput[]): DialogueStep => ({
    memory: closeConversation(memory, conversation),
    conversation: null,
    outputs,
  });
  if (!choice) return finish(context.memory, []);
  if (costOf(choice) > context.memory.coins) {
    return { memory: context.memory, conversation, outputs: [] };
  }

  const outputs: DialogueOutput[] = [];
  const memory = applyEffects(choice.effects, context.memory, outputs);
  const after = { ...context, memory };

  if (choice.ride) {
    const lines = script.haggle;
    const target = context.positions[choice.ride];
    if (!lines || !target) return finish(memory, outputs);
    const bargain = openBargain({
      metres: Math.hypot(target.x - context.at.x, target.z - context.at.z),
      hour: context.hour,
      raining: context.raining,
      rapport: factNumber(memory, lines.rapportFact),
    });
    const place = context.placeNames[choice.ride] ?? choice.ride;
    const opening = fill(pick(lines.open, after, script.id), {
      ask: bargain.ask,
      meter: bargain.meter,
      place,
    });
    const excuse =
      bargain.excuse === 'none' ? '' : ` ${fill(lines[bargain.excuse], { ask: bargain.ask })}`;
    return {
      memory,
      conversation: {
        npcId: script.id,
        nodeId: conversation.nodeId,
        text: opening + excuse,
        choices: haggleChoices(offerChoices(bargain), memory.coins),
        haggle: { bargain, to: choice.ride, lowballs: 0 },
      },
      outputs,
    };
  }

  if (!choice.to) return finish(memory, outputs);
  const step = enter(script, choice.to, after, outputs);
  return step;
}

/** Every problem with a script's wiring, for content tests. Empty means sound. */
export function validateScript(script: NpcScript): string[] {
  const problems: string[] = [];
  if (!script.nodes[script.root]) problems.push(`${script.id}: root "${script.root}" is missing`);
  const reachable = new Set<string>();
  const queue = [script.root];
  while (queue.length > 0) {
    const id = queue.pop() as string;
    if (reachable.has(id)) continue;
    reachable.add(id);
    const node = script.nodes[id];
    if (!node) continue;
    if (node.say.length === 0) problems.push(`${script.id}.${id}: nothing to say`);
    else if (node.say[node.say.length - 1]?.when)
      problems.push(`${script.id}.${id}: the last variant needs no condition, as a fallback`);
    if (node.choices.length > 0 && node.choices.every((choice) => choice.when))
      problems.push(`${script.id}.${id}: every choice is conditional; add a plain way out`);
    for (const choice of node.choices) {
      if (choice.ride && !script.haggle)
        problems.push(`${script.id}.${id}: offers a ride but has no haggle lines`);
      if (choice.to === undefined) continue;
      if (!script.nodes[choice.to])
        problems.push(
          `${script.id}.${id}: choice "${choice.text}" goes to missing node "${choice.to}"`,
        );
      else queue.push(choice.to);
    }
  }
  for (const id of Object.keys(script.nodes)) {
    if (!reachable.has(id)) problems.push(`${script.id}.${id}: unreachable`);
  }
  return problems;
}
