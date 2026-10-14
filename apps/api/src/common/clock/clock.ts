/** Source of the current time. Domain code depends on this instead of `Date.now()` / `new Date()`. */
export interface Clock {
  now(): Date;
}

/** DI token for {@link Clock}. */
export const CLOCK = Symbol('CLOCK');

export class SystemClock implements Clock {
  now(): Date {
    return new Date();
  }
}

/** Deterministic clock for tests: time moves only when told to. */
export class FakeClock implements Clock {
  private current: Date;

  constructor(start: Date | string = '2026-01-01T00:00:00.000Z') {
    this.current = new Date(start);
  }

  now(): Date {
    return new Date(this.current);
  }

  set(time: Date | string): void {
    this.current = new Date(time);
  }

  advance(ms: number): void {
    this.current = new Date(this.current.getTime() + ms);
  }
}
