import { FakeClock, SystemClock } from './clock';

describe('SystemClock', () => {
  it('returns the current system time', () => {
    const before = Date.now();
    const now = new SystemClock().now().getTime();
    expect(now).toBeGreaterThanOrEqual(before);
    expect(now).toBeLessThanOrEqual(Date.now());
  });
});

describe('FakeClock', () => {
  it('starts at the given time and only moves when told to', () => {
    const clock = new FakeClock('2026-10-14T10:00:00.000Z');
    expect(clock.now().toISOString()).toBe('2026-10-14T10:00:00.000Z');

    clock.advance(1500);
    expect(clock.now().toISOString()).toBe('2026-10-14T10:00:01.500Z');

    clock.set('2027-01-01T00:00:00.000Z');
    expect(clock.now().toISOString()).toBe('2027-01-01T00:00:00.000Z');
  });

  it('returns a copy so callers cannot mutate its time', () => {
    const clock = new FakeClock('2026-10-14T10:00:00.000Z');
    clock.now().setFullYear(2000);
    expect(clock.now().toISOString()).toBe('2026-10-14T10:00:00.000Z');
  });
});
