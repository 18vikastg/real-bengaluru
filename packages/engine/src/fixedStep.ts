/**
 * Fixed-timestep accumulator. Simulation advances in constant steps
 * (60 Hz by default) regardless of render rate; `alpha` is the leftover
 * fraction of a step, for interpolating render state between two sim states.
 */
export interface FixedStepOptions {
  /** Simulation rate in Hz. */
  hz?: number;
  /** Cap on steps per frame, so a long stall cannot cause a spiral of death. */
  maxSubSteps?: number;
}

export class FixedStepLoop {
  readonly dt: number;
  private readonly maxSubSteps: number;
  private accumulator = 0;

  constructor(options: FixedStepOptions = {}) {
    const hz = options.hz ?? 60;
    if (!(hz > 0)) throw new RangeError('hz must be positive');
    this.dt = 1 / hz;
    this.maxSubSteps = Math.max(1, options.maxSubSteps ?? 5);
  }

  /**
   * Feed one render frame's elapsed seconds. Calls `step(dt)` zero or more
   * times and returns the interpolation alpha in [0, 1).
   */
  advance(frameSeconds: number, step: (dt: number) => void): number {
    if (frameSeconds > 0 && Number.isFinite(frameSeconds)) {
      this.accumulator += frameSeconds;
    }
    let steps = 0;
    // Epsilon keeps float error from dropping a step on exact multiples of dt.
    while (this.accumulator >= this.dt - 1e-9 && steps < this.maxSubSteps) {
      step(this.dt);
      this.accumulator = Math.max(0, this.accumulator - this.dt);
      steps++;
    }
    if (steps === this.maxSubSteps && this.accumulator >= this.dt) {
      // Too far behind: drop the backlog rather than trying to catch up.
      this.accumulator = 0;
    }
    return this.accumulator / this.dt;
  }

  reset(): void {
    this.accumulator = 0;
  }
}
