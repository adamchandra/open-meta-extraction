import _ from 'lodash';
import path from 'path';
import fs from 'fs-extra';

export function getOrDie<T>(v: T | null | undefined, msg: string = 'null|undef'): T {
  if (v === null || v === undefined) {
    throw new Error(`Error: ${msg}`);
  }
  return v;
}

export function fileOrUndef(file: string|undefined, ...ps: string[]): string|undefined {
  let pres = file;
  if (file) {
    pres = path.resolve(_.join(ps, '/'), file);
    const exists = fs.existsSync(pres);
    const valid = exists? fs.statSync(pres).isFile() : false;
    if (valid) {
      return pres;
    }
  }
  return undefined;
}


export function makeNowTimeString(): string {
  const now = new Date();
  const timeOpts: Intl.DateTimeFormatOptions = {
    timeStyle: 'medium',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  };
  const nowTime = now.toLocaleTimeString('en-US', timeOpts);

  const timestamp = nowTime.replace(/:/g, '.');
  return timestamp;
}


export const delay = (t: number) => new Promise(resolve => setTimeout(resolve, t));


export function newIdGenerator(start: number) {
  let currId = start-1;
  const nextId = () => {
    currId += 1;
    return currId;
  };
  return nextId;
}
