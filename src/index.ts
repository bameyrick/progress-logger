import { formatTime, isEqual, isNullOrUndefined } from '@qntm-code/utils';
import * as chalk from 'chalk';
import * as logUpdate from 'log-update';
import {
  BehaviorSubject,
  Subject,
  combineLatest,
  distinctUntilChanged,
  interval,
  map,
  scan,
  shareReplay,
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
  bytes: boolean;

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
        .reduce((result, duration, index) => {
          const batchIndex = Math.floor(index / batchSize);

          if (!result[batchIndex]) {
            result[batchIndex] = [];
          }

          result[batchIndex].push(duration);

          return result;
        }, [] as Array<Array<number>>)
        .map(batch => Math.round(batch.reduce((sum, duration) => sum + duration, 0) / batch.length));
    }),
    shareReplay(1)
  );

  private readonly interval$ = interval(1000);

  private readonly data$ = combineLatest([this.averageDuration$, this.interval$]).pipe(
    throttleTime(200),
    map(([averageDuration]) => {
      const elapsed = performance.now() - this.startTime;
      const elapsedEta = elapsed * (this.options.total / this.completed - 1);

      const remaining = this.options.total - this.completed;
      const durationEta = averageDuration * remaining;

      return { elapsedEta, durationEta, remaining };
    }),
    distinctUntilChanged((a, b) => isEqual(a, b)),
    withLatestFrom(this.averageDurations$),
    map(([{ remaining, elapsedEta, durationEta }, averages]) => {
      const percentage = (this.completed / this.options.total) * 100;
      const average = averages[averages.length - 1];

      return {
        remaining,
        elapsedEta,
        durationEta,
        percentage,
        average,
        averages,
      };
    })
  );

  constructor(config: ProgressLoggerOptions) {
    this.options = { averageTimeSampleSize: 100, ...config };

    this.data$.pipe(takeUntil(this.disposed$)).subscribe(({ elapsedEta, durationEta, percentage, average, averages }) => {
      let current: string;
      let total: string;
      if (this.options.bytes) {
        current = chalk.blue(formatBytes(this.completed));
        total = chalk.blue(formatBytes(this.options.total));
      } else {
        current = chalk.blue(this.completed.toString().padStart(this.options.total.toString().length, ''));
        total = chalk.blue(this.options.total);
      }

      const incompleteBar = chalk.bgHex(`#333333`)(' ');
      const completedBar = chalk.bgHex('#2AAA8A')(' ');

      const bar = new Array(50)
        .fill('')
        .map((_, index) => (percentage / 2 >= index + 1 ? completedBar : incompleteBar))
        .join('');

      const items: string[] = [
        chalk.cyan(`${this.options.message}: ${current} of ${total}`),
        bar,
        chalk.yellow(`${percentage.toFixed(2).padStart(6, ' ')}%`),
        chalk.cyan(`Est remaining: ${chalk.green(formatTime((durationEta + elapsedEta) / 2))}`),
      ];

      if (averages.some(average => average > 0)) {
        items.push(formatTime(average, { forceAllUnits: false, secondsDecimalPlaces: 1 }));
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call
        items.push(sparkline(averages) as string);
      }

      const result = items.join(' | ');

      if (this.options.logFunction) {
        this.options.logFunction(result);
      } else if (this.options.preventOverwrite) {
        console.log(result);
      } else {
        logUpdate(items.join(' | '));
      }
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

    if (this.completed >= this.options.total) {
      setTimeout(() => {
        logUpdate.done();

        this.dispose();

        console.log(chalk.cyan(`Finished ${this.options.message} in ${formatTime(performance.now() - this.startTime)}`));
      });
    }
  }

  /**
   * Destroys the logger. This should be called when you are done logging to prevent a memory leak.
   */
  public dispose(): void {
    this.disposed$.next();
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
}
