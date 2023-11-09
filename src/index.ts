import { formatTime, isNaNStrict, isNullOrUndefined } from '@qntm-code/utils';
import * as chalk from 'chalk';
import * as logUpdate from 'log-update';
import { BehaviorSubject, Subscription, map, throttleTime } from 'rxjs';
import * as sparkline from 'sparkline';

export interface ProgressLoggerOptions {
  /**
   * Total number of items to process
   */
  totalItems: number;

  /**
   * Message to display in the progress bar
   */
  message: string;

  /**
   * Message to display in the average time section
   */
  averageMessage: string;

  /**
   * Number of samples to use when calculating the average time
   */
  averageTimeSampleSize?: number;
}

export default class ProgressLogger {
  private options?: ProgressLoggerOptions;

  /**
   * Durations of all items
   */
  private durations$?: BehaviorSubject<Array<number>> = new BehaviorSubject<Array<number>>([]);

  /**
   * Average durations of all items
   */
  private readonly averageDurations: Array<number> = [];

  /**
   * Message stream that will be logged to the console
   */
  private readonly message$ = this.durations$?.pipe(
    throttleTime(100, undefined, { trailing: true }),
    map(durations => {
      const nonCachedDurations = this.filterOutliers(durations.filter(duration => duration !== 0));
      const sample = nonCachedDurations.slice(-Math.min(this.options!.averageTimeSampleSize!, Math.max(nonCachedDurations.length - 1, 0)));
      const averageDuration = sample.reduce((sum, duration) => sum + duration, 0) / sample.length;

      if (!isNaNStrict(averageDuration)) {
        this.averageDurations.push(averageDuration);
      }

      const currentItem = durations.length;
      const remainingItems = this.options!.totalItems - currentItem;
      const percentage = Math.round((currentItem / this.options!.totalItems) * 10000) / 100;
      const remaining =
        averageDuration > 0 ? chalk.cyan(`Est remaining: ${chalk.green(formatTime(averageDuration * remainingItems))}`) : '';

      return `${chalk.cyan(
        `${this.options!.message}: ${chalk.blue(
          currentItem.toString().padStart(this.options!.totalItems.toString().length, ' ')
        )} of ${chalk.blue(this.options!.totalItems)}`
      )} | ${new Array(50)
        .fill('')
        .map((_, index) => (percentage / 2 >= index + 1 ? chalk.bgHex('#2AAA8A')(' ') : chalk.bgHex(`#333333`)(' ')))
        .join('')} ${chalk.yellow(`${percentage.toString().padStart(6, ' ')}%`)} | ${remaining} | ${
        this.options!.averageMessage
      }: ${formatTime(averageDuration, { forceAllUnits: false, secondsDecimalPlaces: 1 })} ${this.makeSparkline(this.averageDurations)}`;
    })
  );

  /**
   * Reference to all subscriptions
   */
  private readonly subscriptions = new Subscription();

  /**
   * Start time of the logger
   */
  private readonly startTime = performance.now();

  /**
   * Last start time of an item
   */
  private lastStartTime?: number;

  constructor(config: ProgressLoggerOptions) {
    this.options = { averageTimeSampleSize: 100, ...config };

    this.subscriptions.add(
      this.message$?.subscribe(message => {
        logUpdate(message);
      })
    );
  }

  /**
   * Calling this method will log the completion of an item. This should be called after the item has been completed and the duration to
   * process that item (in milliseconds) should be passed as the argument.
   */
  public itemCompleted(duration?: number): void {
    if (this.durations$) {
      const durations = this.durations$.getValue();

      if (!isNullOrUndefined(this.lastStartTime) || isNullOrUndefined(duration)) {
        const now = performance.now();

        if (!isNullOrUndefined(this.lastStartTime)) {
          this.durations$.next([...durations, now - this.lastStartTime]);
        }

        this.lastStartTime = now;
      } else {
        this.durations$.next([...durations, duration]);
      }

      if (durations.length === this.options!.totalItems - 2) {
        logUpdate.done();

        console.log(chalk.cyan(`Finished ${this.options!.message} in ${formatTime(performance.now() - this.startTime)}`));
      }
    }
  }

  /**
   * Destroys the logger. This should be called when you are done logging to prevent a memory leak.
   */
  public destroy(): void {
    this.subscriptions.unsubscribe();
    this.durations$ = undefined;
  }

  /**
   * Filters outlines from a given array of durations
   */
  private filterOutliers(durations: Array<number>): Array<number> {
    const values = durations.slice().sort((a, b) => a - b);
    const q1 = values[Math.floor((values.length / 4) * 1)];
    const q3 = values[Math.floor((values.length / 4) * 3)];
    const iqr = q3 - q1;
    const maxValue = q3 + iqr * 1.5;
    const minValue = q1 - iqr * 1.5;

    return values.filter(x => x >= minValue && x <= maxValue);
  }

  /**
   * Creates a sparkline for a given array of durations
   */
  private makeSparkline(durations: number[]): string {
    const batchSize = Math.max(Math.ceil(durations.length / 10), 1);

    const samples = durations
      .reduce((result, duration, index) => {
        const batchIndex = Math.floor(index / batchSize);

        if (!result[batchIndex]) {
          result[batchIndex] = [];
        }

        result[batchIndex].push(duration);

        return result;
      }, [] as Array<Array<number>>)
      .map(batch => Math.round(batch.reduce((sum, duration) => sum + duration, 0) / batch.length));

    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    return sparkline(samples) as string;
  }
}
