import { formatTime, isNaNStrict, isNullOrUndefined } from '@qntm-code/utils';
import * as chalk from 'chalk';
import * as logUpdate from 'log-update';
import { BehaviorSubject, Subscription, map, throttleTime } from 'rxjs';
import * as sparkline from 'sparkline';

export default class ProgressLogger {
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
      const sample = nonCachedDurations.slice(-Math.min(this.averageTimeSampleSize, Math.max(nonCachedDurations.length - 1, 0)));
      const averageDuration = sample.reduce((sum, duration) => sum + duration, 0) / sample.length;

      if (!isNaNStrict(averageDuration)) {
        this.averageDurations.push(averageDuration);
      }

      const currentItem = durations.length;
      const remainingItems = this.totalItems - currentItem;
      const percentage = Math.round((currentItem / this.totalItems) * 10000) / 100;
      const remaining =
        averageDuration > 0 ? chalk.cyan(`Est remaining: ${chalk.green(formatTime(averageDuration * remainingItems))}`) : '';

      return `${chalk.cyan(
        `${this.message}: ${chalk.blue(currentItem.toString().padStart(this.totalItems.toString().length, ' '))} of ${chalk.blue(
          this.totalItems
        )}`
      )} | ${new Array(50)
        .fill('')
        .map((_, index) => (percentage / 2 >= index + 1 ? chalk.bgHex('#2AAA8A')(' ') : chalk.bgHex(`#333333`)(' ')))
        .join('')} ${chalk.yellow(`${percentage.toString().padStart(6, ' ')}%`)} | ${remaining} | ${this.averageMessage}: ${formatTime(
        averageDuration,
        { forceAllUnits: false, secondsDecimalPlaces: 1 }
      )} ${this.makeSparkline(this.averageDurations)}`;
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

  constructor(
    private readonly totalItems: number,
    private readonly message: string,
    private readonly averageMessage: string,
    private readonly averageTimeSampleSize: number = 100
  ) {
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

      if (durations.length === this.totalItems - 2) {
        logUpdate.done();

        console.log(chalk.cyan(`Finished ${this.message} in ${formatTime(performance.now() - this.startTime)}`));
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
