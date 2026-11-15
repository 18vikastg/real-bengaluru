import { describe, expect, it } from 'vitest';
import { FixedStepLoop, createRng, daylight, sunDirection } from './index';

describe('FixedStepLoop', () => {
  it('runs exactly one step per 60 Hz frame', () => {
    const loop = new FixedStepLoop();
    let steps = 0;
    for (let i = 0; i < 60; i++) loop.advance(1 / 60, () => steps++);
    expect(steps).toBe(60);
  });

  it('runs two steps for a 30 FPS frame and none for a tiny one', () => {
    const loop = new FixedStepLoop();
    let steps = 0;
    loop.advance(1 / 30, () => steps++);
    expect(steps).toBe(2);
    loop.advance(0.001, () => steps++);
    expect(steps).toBe(2);
  });

  it('returns an interpolation alpha in [0, 1)', () => {
    const loop = new FixedStepLoop();
    const alpha = loop.advance(1.5 / 60, () => {});
    expect(alpha).toBeCloseTo(0.5, 5);
  });

  it('caps sub-steps and drops the backlog after a stall', () => {
    const loop = new FixedStepLoop({ maxSubSteps: 4 });
    let steps = 0;
    loop.advance(10, () => steps++);
    expect(steps).toBe(4);
    loop.advance(0, () => steps++);
    expect(steps).toBe(4);
  });

  it('ignores negative and non-finite frame times', () => {
    const loop = new FixedStepLoop();
    let steps = 0;
    loop.advance(-1, () => steps++);
    loop.advance(Number.NaN, () => steps++);
    loop.advance(Number.POSITIVE_INFINITY, () => steps++);
    expect(steps).toBe(0);
  });

  it('rejects a non-positive rate', () => {
    expect(() => new FixedStepLoop({ hz: 0 })).toThrow(RangeError);
  });
});

describe('sun', () => {
  it('is a unit vector, up at noon and below the horizon at midnight', () => {
    const noon = sunDirection(12);
    expect(Math.hypot(noon.x, noon.y, noon.z)).toBeCloseTo(1, 6);
    expect(noon.y).toBeGreaterThan(0.8);
    expect(sunDirection(0).y).toBeLessThan(0);
  });

  it('rises in the east and sets in the west', () => {
    expect(sunDirection(7).x).toBeGreaterThan(0);
    expect(sunDirection(17).x).toBeLessThan(0);
  });

  it('wraps hours outside 0 to 24', () => {
    expect(sunDirection(36).y).toBeCloseTo(sunDirection(12).y, 6);
    expect(sunDirection(-12).y).toBeCloseTo(sunDirection(12).y, 6);
  });

  it('daylight is 1 at noon, 0 at midnight', () => {
    expect(daylight(12)).toBe(1);
    expect(daylight(0)).toBe(0);
  });
});

describe('createRng', () => {
  it('is deterministic per seed and stays in [0, 1)', () => {
    const a = createRng(42);
    const b = createRng(42);
    const c = createRng(43);
    const first = a();
    expect(b()).toBe(first);
    expect(c()).not.toBe(first);
    for (let i = 0; i < 1000; i++) {
      const v = a();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});
