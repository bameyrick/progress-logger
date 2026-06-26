import { afterEach, describe, expect, it, vi } from 'vitest';
import ProgressLogger from './index.js';

// vi.hoisted ensures these mock handles are available inside the vi.mock factory below,
// since vi.mock calls are hoisted to the top of the file before variable declarations run.
const { mockLogUpdate, mockLogUpdateDone } = vi.hoisted(() => {
  const done = vi.fn();
  const fn = Object.assign(vi.fn(), { done });
  return { mockLogUpdate: fn, mockLogUpdateDone: done };
});

// Chalk is replaced with a transparent proxy so render output is plain text with no ANSI codes.
vi.mock('chalk', () => {
  const makeProxy = (): unknown =>
    new Proxy((str: unknown) => str, {
      get(_target, prop) {
        if (prop === 'bgHex') return () => makeProxy();
        return makeProxy();
      },
    });
  return { default: makeProxy() };
});

vi.mock('log-update', () => ({
  default: mockLogUpdate,
}));

// sparkline exports a plain function via module.exports; mock it to avoid
// real terminal-sparkline rendering during tests.
vi.mock('sparkline', () => ({ default: vi.fn().mockReturnValue('▁▂▃▄▅▆▇█') }));

// Helper: builds a logger that captures all render and log output into an array.
function makeLogger(options: Partial<ConstructorParameters<typeof ProgressLogger>[0]> = {}) {
  const output: string[] = [];
  const logger = new ProgressLogger({
    total: 10,
    message: 'Processing',
    logFunction: (...args) => output.push(String(args[0])),
    ...options,
  });
  return { logger, output };
}

describe('ProgressLogger', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
    mockLogUpdate.mockClear();
    mockLogUpdateDone.mockClear();
  });

  describe('render output via logFunction', () => {
    it('renders on the first tick', () => {
      const { logger, output } = makeLogger();
      logger.tick(1, 100);
      expect(output.length).toBeGreaterThan(0);
      logger.dispose();
    });

    it('includes the message in render output', () => {
      const { logger, output } = makeLogger({ message: 'Uploading files' });
      logger.tick(1, 100);
      expect(output[output.length - 1]).toContain('Uploading files');
      logger.dispose();
    });

    it('includes the correct percentage', () => {
      const { logger, output } = makeLogger({ total: 10 });
      logger.tick(5, 100); // 50%
      expect(output[output.length - 1]).toContain('50.00%');
      logger.dispose();
    });

    it('includes current and total counts', () => {
      const { logger, output } = makeLogger({ total: 20 });
      logger.tick(8, 100);
      const last = output[output.length - 1];
      expect(last).toContain(' 8'); // padded current
      expect(last).toContain('20'); // total
      logger.dispose();
    });

    it('renders again on subsequent ticks', () => {
      const { logger, output } = makeLogger();
      logger.tick(1, 100);
      const afterFirst = output.length;
      logger.tick(1, 100);
      expect(output.length).toBeGreaterThan(afterFirst);
      logger.dispose();
    });
  });

  describe('bytes mode', () => {
    it('displays formatted byte values in render output', () => {
      const { logger, output } = makeLogger({
        total: 2_000_000,
        message: 'Downloading',
        bytes: true,
      });
      logger.tick(1_500_000, 1000);
      expect(output[output.length - 1]).toContain('MB');
      logger.dispose();
    });

    it('shows the total in bytes format', () => {
      const { logger, output } = makeLogger({
        total: 2_000_000_000,
        message: 'Syncing',
        bytes: true,
      });
      logger.tick(1_000_000_000, 1000);
      expect(output[output.length - 1]).toContain('GB');
      logger.dispose();
    });
  });

  describe('preventOverwrite', () => {
    it('uses console.log instead of logUpdate', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const logger = new ProgressLogger({ total: 10, message: 'test', preventOverwrite: true });
      logger.tick(1, 100);

      expect(consoleSpy).toHaveBeenCalled();
      expect(mockLogUpdate).not.toHaveBeenCalled();
      logger.dispose();
    });
  });

  describe('default output (logUpdate)', () => {
    it('calls logUpdate when no logFunction or preventOverwrite is set', () => {
      const logger = new ProgressLogger({ total: 10, message: 'test' });
      logger.tick(1, 100);
      expect(mockLogUpdate).toHaveBeenCalled();
      logger.dispose();
    });
  });

  describe('tick()', () => {
    it('accepts an explicit duration argument', () => {
      const { logger, output } = makeLogger();
      expect(() => logger.tick(1, 500)).not.toThrow();
      expect(output.length).toBeGreaterThan(0);
      logger.dispose();
    });

    it('accepts a batch amount greater than 1', () => {
      const { logger, output } = makeLogger({ total: 10 });
      logger.tick(5, 200); // 50%
      expect(output[output.length - 1]).toContain('50.00%');
      logger.dispose();
    });
  });

  describe('completion', () => {
    it('logs a "Finished" message with the logger message when total is reached', () => {
      const { logger, output } = makeLogger({ total: 3, message: 'Importing' });
      logger.tick(1, 100);
      logger.tick(1, 100);
      logger.tick(1, 100); // reaches total

      const finishedEntry = output.find(line => line.includes('Finished') && line.includes('Importing'));
      expect(finishedEntry).toBeTruthy();
    });

    it('auto-disposes on completion — subsequent dispose() calls are no-ops', () => {
      const { logger } = makeLogger({ total: 1 });
      logger.tick(1, 100); // completes and auto-disposes
      const doneCallsAfterCompletion = mockLogUpdateDone.mock.calls.length;

      logger.dispose(); // should be a no-op
      expect(mockLogUpdateDone.mock.calls.length).toBe(doneCallsAfterCompletion);
    });

    it('percentage is capped at 100% when completed exceeds total', () => {
      const { logger, output } = makeLogger({ total: 5 });
      logger.tick(3, 100);
      logger.tick(3, 100); // overshoots total (completed = 6 > 5)

      const lastRender = output.filter(l => !l.startsWith('Finished')).at(-1) ?? '';
      expect(lastRender).toContain('100.00%');
    });
  });

  describe('dispose()', () => {
    it('is idempotent — multiple calls invoke logUpdate.done only once', () => {
      const logger = new ProgressLogger({ total: 10, message: 'test' });
      logger.dispose();
      logger.dispose();
      logger.dispose();
      expect(mockLogUpdateDone.mock.calls.length).toBe(1);
    });
  });

  describe('throttleMs', () => {
    it('skips renders that fall within the throttle window', () => {
      let now = 1000;
      vi.spyOn(performance, 'now').mockImplementation(() => now);

      const { logger, output } = makeLogger({ total: 100, throttleMs: 200 });

      logger.tick(1, 100); // first render always fires (lastRenderAt was 0)
      const afterFirst = output.length;

      now = 1100; // only 100 ms later — inside the 200 ms window
      logger.tick(1, 100);
      expect(output.length).toBe(afterFirst);

      now = 1201; // past the 200 ms window
      logger.tick(1, 100);
      expect(output.length).toBeGreaterThan(afterFirst);

      logger.dispose();
    });

    it('renders immediately when throttleMs is 0', () => {
      const { logger, output } = makeLogger({ total: 100, throttleMs: 0 });
      logger.tick(1, 100);
      logger.tick(1, 100);
      expect(output.length).toBeGreaterThanOrEqual(2);
      logger.dispose();
    });
  });

  describe('1-second interval', () => {
    it('triggers a render every second independent of tick()', () => {
      vi.useFakeTimers();
      let now = 0;
      vi.spyOn(performance, 'now').mockImplementation(() => now);

      const { logger, output } = makeLogger({ total: 100 });

      // Provide initial data so the interval render passes the NaN filter.
      now = 500;
      logger.tick(1, 100);
      const afterTick = output.length;

      // Advance mock clock so elapsedEta changes (required to bypass distinctUntilChanged).
      now = 1600;
      vi.advanceTimersByTime(1000);

      expect(output.length).toBeGreaterThan(afterTick);
      logger.dispose();
    });
  });

  describe('averageTimeSampleSize', () => {
    it('continues to render correctly after tick count exceeds sample size', () => {
      const { logger, output } = makeLogger({ total: 1000, averageTimeSampleSize: 5 });

      for (let i = 0; i < 20; i++) {
        logger.tick(1, 100);
      }

      expect(output.length).toBeGreaterThan(0);
      expect(output[output.length - 1]).toContain('2.00%');
      logger.dispose();
    });
  });
});
