/**
 * What the city remembers about the player. Everything a character says or
 * does later is decided from this record, so it is plain data that can be
 * saved and restored.
 */
export type Fact = string | number | boolean;

export interface CityMemory {
  /** Named facts set by conversations and missions, e.g. "manju.rapport". */
  facts: Record<string, Fact>;
  /** How many conversations the player has had with each character. */
  met: Record<string, number>;
  /** Rupees in the player's pocket. */
  coins: number;
  /** Things being carried, by id, with a count. */
  items: Record<string, number>;
  /** Journal entries, newest last. */
  notes: string[];
}

export const STARTING_COINS = 300;
const MAX_NOTES = 40;

export function createMemory(): CityMemory {
  return { facts: {}, met: {}, coins: STARTING_COINS, items: {}, notes: [] };
}

export function factNumber(memory: CityMemory, key: string): number {
  const value = memory.facts[key];
  return typeof value === 'number' ? value : 0;
}

export function hasItem(memory: CityMemory, item: string): boolean {
  return (memory.items[item] ?? 0) > 0;
}

export function withFact(memory: CityMemory, key: string, value: Fact): CityMemory {
  return { ...memory, facts: { ...memory.facts, [key]: value } };
}

export function withCoins(memory: CityMemory, delta: number): CityMemory {
  return { ...memory, coins: Math.max(0, memory.coins + delta) };
}

export function withItem(memory: CityMemory, item: string, delta: number): CityMemory {
  const count = Math.max(0, (memory.items[item] ?? 0) + delta);
  const items = { ...memory.items };
  if (count > 0) items[item] = count;
  else delete items[item];
  return { ...memory, items };
}

export function withNote(memory: CityMemory, note: string): CityMemory {
  if (memory.notes.includes(note)) return memory;
  return { ...memory, notes: [...memory.notes, note].slice(-MAX_NOTES) };
}

export function withMeeting(memory: CityMemory, npcId: string): CityMemory {
  return { ...memory, met: { ...memory.met, [npcId]: (memory.met[npcId] ?? 0) + 1 } };
}

/** Accepts anything (for example a parsed save file) and returns a valid memory. */
export function reviveMemory(value: unknown): CityMemory {
  const fresh = createMemory();
  if (typeof value !== 'object' || value === null) return fresh;
  const raw = value as Partial<Record<keyof CityMemory, unknown>>;
  const record = <T>(input: unknown, keep: (entry: unknown) => entry is T): Record<string, T> => {
    const out: Record<string, T> = {};
    if (typeof input !== 'object' || input === null) return out;
    for (const [key, entry] of Object.entries(input)) if (keep(entry)) out[key] = entry;
    return out;
  };
  const isFact = (entry: unknown): entry is Fact =>
    typeof entry === 'string' || typeof entry === 'boolean' || Number.isFinite(entry);
  const isCount = (entry: unknown): entry is number =>
    typeof entry === 'number' && Number.isFinite(entry) && entry > 0;
  return {
    facts: record(raw.facts, isFact),
    met: record(raw.met, isCount),
    coins:
      typeof raw.coins === 'number' && Number.isFinite(raw.coins)
        ? Math.max(0, Math.round(raw.coins))
        : fresh.coins,
    items: record(raw.items, isCount),
    notes: Array.isArray(raw.notes)
      ? raw.notes.filter((note): note is string => typeof note === 'string').slice(-MAX_NOTES)
      : [],
  };
}
