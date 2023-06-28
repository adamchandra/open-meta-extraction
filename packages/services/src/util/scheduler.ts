import _ from 'lodash';

import {
  delay,
  putStrLn,
  asyncForever
} from '@watr/commonlib';

export interface Scheduler {
  run(): Promise<void>;
}

function decodeField<T>(
  test: (x: unknown) => x is T,
  field: string,
): (args: Record<string, any>) => T | undefined {
  function decoder(obj: Record<string, any>): T | undefined {
    if (!(field in obj)) return;
    if (!test(obj[field])) return;
    return obj[field];
  }
  return decoder;
}

/*
 *
 Format is:
    hh:mm:ss.ms
 */
export function initScheduler(args: unknown): Scheduler | undefined {
  if (typeof args !== 'object') return;
  if (args === null) return;
  const decodeInterval = decodeField(_.isString, 'interval');
  const interval = decodeInterval(args);
  if (!interval) return;
  const segments = interval.split(':')

  let hours: number;
  let minutes: number;
  let seconds: number;
  let repeat: number;


  'interval' in args && typeof args.interval === 'number'


  // await asyncForever(async () => {
  //   putStrLn(`${counter}: ${message}`);
  //   counter += 1;
  //   await delay(interval);
  // });

  return;
}

export function scheduleEveryTimeInterval(
  startAt: Date
) {
}
export function scheduleAtClockTime(
  startAt: Date,
  repeat: boolean
) {
}
