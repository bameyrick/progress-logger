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
      - [tick](#tick)
      - [dispose](#dispose)
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

| Argument              | Type                        | Description                                                                             |
| --------------------- | --------------------------- | --------------------------------------------------------------------------------------- |
| total                 | number                      | The total number of items to process.                                                   |
| message               | string                      | The message to display before the progress bar.                                         |
| bytes                 | _Optional_ boolean          | Whether the total is bytes. Will format output accordingly                              |
| averageTimeSampleSize | _Optional_ number           | The number of items to use when calculating the average time per item. Defaults to 100. |
| preventOverwrite      | _Optional_ boolean          | Prevent overwriting the previous log of the bar                                         |
| logFunction           | _optiona_ (...args) => void | Provide a custom logging function                                                       |

### Methods

#### tick

Call `tick` on the `ProgressLogger` to notify the progress bar that item(s) have been processed. This method takes the following arguments:

| Argument | Type   | Optional | Description                                                  |
| -------- | ------ | -------- | ------------------------------------------------------------ |
| amount   | number | true     | The number of items that were just processed (not the total) |
| duration | number | true     | The time taken to process the current item(s).               |

If you don't pass a `time` argument when calling `tick`, the average time will be calculated using the durations between each time `tick` is called. This is useful if you are processing items batches as multiple items may be being processed at the same time.

#### dispose

If you want to stop using the ProgressLogger due to an error in your process, you must call `dispose` on the `ProgressLogger` instance to ensure the progress logger is disposed and prevent a memory leak. The ProgressLogger will automatically dispose itself if it reaches 100%.

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
  });


  await asyncForEach(itemsToProcess, async item => {
    const startTime = performance.now();

    await someAsyncProcess(item);

    logger.tick();
  })
==
}
```
