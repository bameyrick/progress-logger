# @qntm-code/progress-logger

A simple progress logger for Node.js that outputs progress and estimated time remaining to the console.

[![GitHub release](https://img.shields.io/github/release/bameyrick/progress-logger.svg)](https://github.com/bameyrick/progress-logger/releases)
[![Quality Gate Status](https://sonarcloud.io/api/project_badges/measure?project=bameyrick_progress-logger&metric=alert_status)](https://sonarcloud.io/summary/new_code?id=bameyrick_progress-logger)

- [@qntm-code/progress-logger](#qntm-codeprogress-logger)
  - [Installation](#installation)
    - [npm](#npm)
    - [yarn](#yarn)
  - [Usage](#usage)
    - [Constructor Arguments](#constructor-arguments)
    - [Methods](#methods)
      - [itemCompleted](#itemcompleted)
      - [destroy](#destroy)
    - [Example](#example)

## Installation

You can install via npm or yarn.

### npm

```bash
npm install --save @qntm-code/progress-logger
```

### yarn

```bash
yarn add @qntm-code/progress-logger
```

## Usage

### Constructor Arguments

First you must create a new instance of the `ProgressLogger` class. The constructor takes the following arguments:

| Argument              | Type              | Description                                                                             |
| --------------------- | ----------------- | --------------------------------------------------------------------------------------- |
| total                 | number            | The total number of items to process.                                                   |
| message               | string            | The message to display before the progress bar.                                         |
| averageMessage        | string            | The message to display before the average time per item.                                |
| averageTimeSampleSize | _Optional_ number | The number of items to use when calculating the average time per item. Defaults to 100. |

### Methods

#### itemCompleted

Call `itemCompleted` on the `ProgressLogger` instance to increment the progress bar by one item. This method takes the following arguments:

| Argument | Type   | Optional | Description                                                                                      |
| -------- | ------ | -------- | ------------------------------------------------------------------------------------------------ |
| time     | number | true     | The time taken to process the current item. This is used to calculate the average time per item. |

If you don't pass a `time` argument when calling `itemCompleted`, the average time will be calculated using the durations between each time `itemCompleted` is called. This is useful if you are processing items batches as multiple items may be being processed at the same time.

#### destroy

After you've finished processing your items, you must call `destroy` on the `ProgressLogger` instance to ensure the progress logger is destroyed and prevent a memory leak.

### Example

```typescript
import { ProgressLogger } from '@qntm-code/progress-logger';

async function someAsyncProcess(): Promise<void> {
  // Do something
}

async function main(): Promise<void> {
  const itemsToProcess = [
    /* Some data */
  ];
  const total = itemsToProcess.length;

  const logger = new ProgressLogger({
    total,
    message: 'Processing',
    averageMessage: 'Average process time',
  });

  for (let i = 0; i < total; i++) {
    const startTime = performance.now();

    await someAsyncProcess();

    logger.itemCompleted(performance.now() - startTime);
  }

  /**
   * You must call destroy() after you've finshed processing your items to ensure the progress logger is
   * destroyed and prevent a memory leak.
   */
  logger.destroy();
}
```
