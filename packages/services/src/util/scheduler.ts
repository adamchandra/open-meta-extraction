import _ from 'lodash';

import {
  delay,
  putStrLn,
  asyncForever
} from '@watr/commonlib';

import * as E from 'fp-ts/Either';
import later from '@breejs/later';
import * as bree from '@breejs/later';

export interface Scheduler {
  run(): Promise<void>;
}

export type ScheduleData = bree.ScheduleData;

export function parseSchedule(scheduleSpec: string): E.Either<string[], ScheduleData> {
  const schedule = later.parse.text(scheduleSpec);
  const { error } = schedule;
  if (error > -1) {
    const pos = '^'.padStart(error);
    const errors = [
      'Syntax error in schedule:',
      `>  ${scheduleSpec}`,
      `>  ${pos}`,
      'See https://breejs.github.io/later/parsers.html#text for syntax',
    ];
    return E.left(errors);
  }
  return E.right(schedule);
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
  const segments = interval.split(':');

  let hours: number;
  let minutes: number;
  let seconds: number;
  let repeat: number;


  'interval' in args && typeof args.interval === 'number';


  // await asyncForever(async () => {
  //   putStrLn(`${counter}: ${message}`);
  //   counter += 1;
  //   await delay(interval);
  // });
}

export function scheduleEveryTimeInterval(
  startAt: Date
) {}
export function scheduleAtClockTime(
  startAt: Date,
  repeat: boolean
) {}
