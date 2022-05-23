import _ from 'lodash';

import {
  Transform,
  through,
  ClientFunc,
  CacheFileKey,
} from '~/predef/extraction-prelude';


export const loadTextFile: Transform<CacheFileKey, string> =
  through((cacheKey: CacheFileKey, { fileContentCache }) =>
    (cacheKey in fileContentCache
      ? fileContentCache[cacheKey]
      : ClientFunc.halt(`cache has no record for key ${cacheKey}`)
    ), `loadTextFile`);

export const splitLines: Transform<string, string[]> =
  through((s: string) => s.split('\n'))

export const grepFilter: (regex: RegExp) => Transform<string[], string[]> =
  (regex) => through(
    (lines: string[]) => _.filter(lines, l => regex.test(l)),
    `grep(${regex.source})`
  );


export const grepFilterNot: (regex: RegExp) => Transform<string[], string[]> =
  (regex) => through(
    (lines: string[]) => _.filter(lines, l => !regex.test(l)),
    `grep(${regex.source})`
  );


export const grepDropUntil: (regex: RegExp) => Transform<string[], string[]> =
  (regex) => through(
    (lines: string[]) => _.dropWhile(lines, l => !regex.test(l)),
    `grepDropUntil(${regex.source})`
  );

export const grepTakeUntil: (regex: RegExp) => Transform<string[], string[]> =
  (regex) => through(
    (lines: string[]) => _.takeWhile(lines, l => !regex.test(l)),
    `grepTakeUntil(${regex.source})`
  );

export const dropN: (num: number) => Transform<string[], string[]> =
  (num) => through(
    (lines: string[]) => _.drop(lines, num) ,
    `dropN(${num})`
  );

export const joinLines: (join: string) => Transform<string[], string> =
  (joinstr) => through(
      (lines: string[]) => _.join(lines, joinstr),
      `joinLines(${joinstr})`
  );
