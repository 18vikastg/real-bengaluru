/**
 * Haggling over an auto fare. The driver opens high, has a floor he will not
 * go below, and a limited supply of patience. How he treats the player
 * depends on their history together (rapport), the hour and the weather.
 */
import { wrapHour } from './world';

/** Metered fare: a minimum for the first two kilometres, then per kilometre. */
export const METER_MINIMUM = 36;
export const METER_PER_KM = 18;

export function meterFare(metres: number): number {
  const km = (metres * 1.3) / 1000;
  const fare = METER_MINIMUM + Math.max(0, km - 2) * METER_PER_KM;
  return Math.round(fare / 5) * 5;
}

export interface BargainContext {
  /** Straight-line trip length in metres. */
  metres: number;
  hour: number;
  raining: boolean;
  /** -3 (he remembers you badly) to +3 (regular customer). */
  rapport: number;
}

export interface Bargain {
  meter: number;
  /** What the driver is currently asking. */
  ask: number;
  /** The lowest fare he will take. */
  floor: number;
  patience: number;
  /** Why the price is what it is, in his words. */
  excuse: 'none' | 'rain' | 'night' | 'peak';
}

export type BargainOutcome =
  | { kind: 'deal'; fare: number; mood: 'happy' | 'fine' | 'grumbling' }
  | { kind: 'counter'; bargain: Bargain }
  | { kind: 'refused' };

const roundFare = (value: number) => Math.round(value / 10) * 10;

export function openBargain(context: BargainContext): Bargain {
  const meter = meterFare(context.metres);
  const hour = wrapHour(context.hour);
  const night = hour >= 22 || hour < 5;
  const peak = (hour >= 8 && hour < 10.5) || (hour >= 17.5 && hour < 20.5);
  let markup = 1.5;
  let excuse: Bargain['excuse'] = 'none';
  if (context.raining) {
    markup += 0.5;
    excuse = 'rain';
  } else if (night) {
    markup += 0.5;
    excuse = 'night';
  } else if (peak) {
    markup += 0.25;
    excuse = 'peak';
  }
  const rapport = Math.max(-3, Math.min(3, context.rapport));
  markup -= rapport * 0.1;
  const floorMarkup = 1 + (context.raining || night ? 0.25 : 0.08) - Math.max(0, rapport) * 0.03;
  const floor = Math.max(meter, roundFare(meter * floorMarkup));
  const ask = Math.max(floor + 10, roundFare(meter * markup));
  return { meter, ask, floor, patience: rapport < 0 ? 2 : 3, excuse };
}

/** The offers the player can pick from: a cheeky one, a fair one, and paying up. */
export function offerChoices(bargain: Bargain): { low: number; fair: number; full: number } {
  const low = Math.max(20, roundFare(bargain.meter * 0.8));
  const fair = Math.max(low + 10, Math.min(bargain.ask - 10, bargain.floor + 10));
  return { low, fair, full: bargain.ask };
}

export function makeOffer(bargain: Bargain, offer: number): BargainOutcome {
  if (offer >= bargain.ask) return { kind: 'deal', fare: bargain.ask, mood: 'happy' };
  if (offer >= bargain.floor) {
    const mood = offer >= (bargain.ask + bargain.floor) / 2 ? 'fine' : 'grumbling';
    return { kind: 'deal', fare: offer, mood };
  }
  const patience = bargain.patience - 1;
  if (patience <= 0) return { kind: 'refused' };
  // He comes down part of the way towards his floor each time.
  const ask = Math.max(bargain.floor, roundFare(bargain.ask - (bargain.ask - bargain.floor) * 0.5));
  return { kind: 'counter', bargain: { ...bargain, ask, patience } };
}

/** How a finished negotiation changes what the driver thinks of the player. */
export function rapportChange(outcome: BargainOutcome, lowballs: number): number {
  if (outcome.kind === 'refused') return -1;
  if (outcome.kind === 'counter') return 0;
  if (outcome.mood === 'happy') return 1;
  if (outcome.mood === 'fine') return lowballs === 0 ? 1 : 0;
  return lowballs >= 2 ? -1 : 0;
}
