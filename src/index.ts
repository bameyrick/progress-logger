import { formatTime, isEqual, isNaNStrict, isNullOrUndefined } from '@qntm-code/utils';
import * as chalk from 'chalk';
import * as logUpdate from 'log-update';
import {
  asyncScheduler,
  BehaviorSubject,
  distinctUntilChanged,
  filter,
  interval,
  map,
  merge,
  scan,
  shareReplay,
  Subject,
  takeUntil,
  throttleTime,
  withLatestFrom,
} from 'rxjs';
import * as sparkline from 'sparkline';
import { formatBytes } from './format-bytes';

export interface ProgressLoggerOptions {
  /**
   * Total number of items to process
   */
  total: number;

  /**
   * Message to display in the progress bar
   */
  message: string;

  /**
   * Whether total is bytes
   */
  bytes?: boolean;

  /**
   * Number of samples to use when calculating the average time
   */
  averageTimeSampleSize?: number;

  /**
   * Prevent overwriting the previous log of the bar
   */
  preventOverwrite?: boolean;

  /**
   * Custom logger function
   */
  logFunction?: (...args) => void;

  /**
   * Minimum time (ms) between progress renders.
   * Useful for tight loops to avoid spamming the console.
   * Set to 0 or leave undefined to disable throttling.
   */
  throttleMs?: number;
}

interface ProgressLoggerData {
  remaining: number;
  elapsedEta: number;
  durationEta: number;
  percentage: number;
  averages: number[];
}

export default class ProgressLogger {
  private options: ProgressLoggerOptions;

  private readonly startTime = performance.now();

  private lastCompleted = this.startTime;

  private completed = 0;

  private readonly disposed$ = new Subject<void>();

  private readonly durations$ = new BehaviorSubject<number[]>([]);

  private readonly averageDuration$ = this.durations$.pipe(
    map(durations => {
      const filteredDurations = this.filterOutliers(durations);
      const sample = this.filterOutliers(durations).slice(
        -Math.min(this.options.averageTimeSampleSize!, Math.max(filteredDurations.length - 1, 0))
      );

      return sample.reduce((sum, duration) => sum + duration, 0) / sample.length;
    }),
    shareReplay(1)
  );

  private readonly averageDurations$ = this.averageDuration$.pipe(
    scan((result, duration) => [...result, duration], []),
    map(durations => {
      const batchSize = Math.max(Math.ceil(durations.length / 10), 1);

      return durations
        .reduce(
          (result, duration, index) => {
            const batchIndex = Math.floor(index / batchSize);

            if (!result[batchIndex]) {
              result[batchIndex] = [];
            }

            result[batchIndex].push(duration);

            return result;
          },
          [] as Array<Array<number>>
        )
        .map(batch => Math.round(batch.reduce((sum, duration) => sum + duration, 0) / batch.length));
    }),
    shareReplay(1)
  );

  private readonly interval$ = interval(1000);

  private lastData: ProgressLoggerData | undefined;

  constructor(config: ProgressLoggerOptions) {
    this.options = { averageTimeSampleSize: 100, throttleMs: 0, ...config };

    // Triggers a render on each tick() (durations$ emits) and also once per second.
    // This allows synchronous loops (that block the event loop) to still render progress.
    const renderTrigger$ = merge(this.interval$, this.durations$.pipe(map(() => 0)));

    const throttledTrigger$ =
      this.options.throttleMs && this.options.throttleMs > 0
        ? renderTrigger$.pipe(throttleTime(this.options.throttleMs, asyncScheduler, { leading: true, trailing: true }))
        : renderTrigger$;

    throttledTrigger$
      .pipe(
        withLatestFrom(this.averageDuration$, this.averageDurations$),
        map(([, averageDuration, averages]) => {
          const elapsed = performance.now() - this.startTime;
          const elapsedEta = elapsed * (this.options.total / this.completed - 1);

          const remaining = Math.min(this.options.total - this.completed, this.options.total);
          const durationEta = averageDuration * remaining;

          const percentage = (this.completed / this.options.total) * 100;

          return {
            remaining,
            elapsedEta,
            durationEta,
            percentage,
            averages,
          } satisfies ProgressLoggerData;
        }),
        filter(({ elapsedEta, durationEta }) => !isNaNStrict(elapsedEta) && !isNaNStrict(durationEta)),
        distinctUntilChanged((a, b) => isEqual(a, b)),
        shareReplay(1),
        takeUntil(this.disposed$)
      )
      .subscribe(data => {
        this.lastData = data;
        this.render(data);
      });
  }

  /**
   * Calling this method will notify the bar that a the bar that an item(s) have completed
   */
  public tick(amount = 1, duration?: number): void {
    this.completed += amount;

    const now = performance.now();

    if (isNullOrUndefined(duration)) {
      duration = now - this.lastCompleted;
    }

    this.lastCompleted = now;

    const durationPerItem = duration / amount;

    this.durations$.next([...this.durations$.getValue(), durationPerItem]);

    if (this.completed >= this.options.total || Math.round((this.completed / this.options.total) * 10000) / 100 >= 100) {
      this.forceRender();
      this.dispose();
      this.log(chalk.cyan(`Finished ${this.options.message} in ${formatTime(performance.now() - this.startTime)}`));
    }
  }

  /**
   * Disposes the logger. This should be called when you are done logging to prevent a memory leak.
   */
  public dispose(): void {
    this.disposed$.next();
    logUpdate.done();
  }

  /**
   * Filters outliers from a given array of durations
   */
  private filterOutliers(durations: number[]): number[] {
    const values = durations.slice().sort((a, b) => a - b);
    const q1 = values[Math.floor((values.length / 4) * 1)];
    const q3 = values[Math.floor((values.length / 4) * 3)];
    const iqr = q3 - q1;
    const maxValue = q3 + iqr * 1.5;
    const minValue = q1 - iqr * 1.5;

    return values.filter(x => x >= minValue && x <= maxValue);
  }

  private log(message: string): void {
    if (this.options.logFunction) {
      this.options.logFunction(message);
    } else {
      console.log(message);
    }
  }

  private forceRender(): void {
    if (this.lastData) {
      this.render(this.lastData);
      return;
    }

    const averageDuration = this.calculateAverageDuration();
    if (isNaNStrict(averageDuration)) {
      return;
    }

    const elapsed = performance.now() - this.startTime;
    const elapsedEta = elapsed * (this.options.total / this.completed - 1);
    const remaining = Math.min(this.options.total - this.completed, this.options.total);
    const durationEta = averageDuration * remaining;
    const percentage = (this.completed / this.options.total) * 100;

    if (isNaNStrict(elapsedEta) || isNaNStrict(durationEta)) {
      return;
    }

    this.render({ remaining, elapsedEta, durationEta, percentage, averages: [] });
  }

  private calculateAverageDuration(): number {
    const durations = this.durations$.getValue();
    if (durations.length === 0) {
      return NaN;
    }

    const filteredDurations = this.filterOutliers(durations);
    const sampleSize = Math.min(this.options.averageTimeSampleSize!, Math.max(filteredDurations.length - 1, 0));
    const sample = this.filterOutliers(durations).slice(-sampleSize);
    if (sample.length === 0) {
      return NaN;
    }

    return sample.reduce((sum, duration) => sum + duration, 0) / sample.length;
  }

  private render({ elapsedEta, durationEta, percentage, averages }: ProgressLoggerData): void {
    let current: string;
    let total: string;
    if (this.options.bytes) {
      current = chalk.blue(formatBytes(this.completed));
      total = chalk.blue(formatBytes(this.options.total));
    } else {
      current = chalk.blue(this.completed.toString().padStart(this.options.total.toString().length, ' '));
      total = chalk.blue(this.options.total);
    }

    const incompleteBar = chalk.bgHex(`#333333`)(' ');
    const completedBar = chalk.bgHex('#2AAA8A')(' ');

    const bar = new Array(50)
      .fill('')
      .map((_, index) => (percentage / 2 >= index ? completedBar : incompleteBar))
      .join('');

    const items: string[] = [
      chalk.cyan(`${this.options.message}: ${current} of ${total}`),
      bar,
      chalk.yellow(`${percentage.toFixed(2).padStart(6, ' ')}%`),
      chalk.cyan(`Est remaining: ${chalk.green(formatTime((durationEta + elapsedEta) / 2))}`),
    ];

    if (averages.some(average => average > 0)) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call
      items.push(sparkline(averages) as string);
    }

    const result = items.join(' | ');

    if (this.options.logFunction) {
      this.options.logFunction(result);
    } else if (this.options.preventOverwrite) {
      console.log(result);
    } else {
      logUpdate(result);
    }
  }
}
