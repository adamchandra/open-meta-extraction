import _ from 'lodash';

import * as Diff from 'diff';
import Crypto from 'crypto-js';

import { parseJSON, isLeft, toError } from 'fp-ts/lib/Either';
// TODO import { parse as parseJSON } from 'fp-ts/lib/Json';

export function shaEncodeAsHex(str: string): string {
  const cryptoSha = Crypto.SHA1(str);
  return cryptoSha.toString();
}

export function matchAll(re: RegExp, str: string): Array<[number, number]> {
  const re0 = new RegExp(re);
  const matchOffsets: [number, number][] = [];
  let matchArr;
  while ((matchArr = re0.exec(str)) !== null) {
    const mstr = matchArr[0];
    const mstart = matchArr.index;
    const last = re0.lastIndex;
    const mend = last > 0 ? last : mstart + mstr.length;
    matchOffsets.push([mstart, mend]);
  }
  return matchOffsets;
}

export function stripMargin(block: string): string {
  const lines = block.split('\n');
  const stripped = stripMargins(lines);
  return stripped.join('\n');
}

export function stripMargins(lines: string[]): string[] {
  return _
    .map(lines, l => {
      if (/^ *\|/.test(l)) {
        return l.slice(l.indexOf('|')+1);
      }
      return l;
    });
}

export function parseJsonStripMargin(s: string): any | undefined {
  const s0 = stripMargin(s);
  return parseJson(s0);
}

export function parseJson(s: string): any | undefined {
  const parsed = parseJSON(s, toError);

  if (isLeft(parsed)) {
    const syntaxError = parsed.left;
    console.log(`Parsing Error: ${syntaxError}`);

    const posRE = /position (\d+)/;
    const posMatch = syntaxError.message.match(posRE);

    if (posMatch && posMatch.length > 1) {
      const errIndex = Number.parseInt(posMatch[1]);
      const begin = Math.max(0, errIndex - 50);
      const end = Math.min(s.length, errIndex + 50);
      const pre = s.slice(begin, errIndex + 1);
      const post = s.slice(errIndex + 1, end);
      console.log(`${syntaxError}\nContext:\n${pre} <-- Error\n${post}`);
    }
    return;
  }
  return parsed.right;
}

type DiffCharsArgs = {
  brief: boolean
};

export interface AddChange {
  kind: 'add';
  value: string;
  count: number;
}
export interface RemoveChange {
  kind: 'remove';
  value: string;
  count: number;
}

export interface Unchanged {
  kind: 'unchanged';
  value?: string;
  count: number;
}
export type Change = AddChange | RemoveChange | Unchanged;

export function isAdd(c: Change): c is AddChange {
  return c.kind === 'add';
}
export function isRemove(c: Change): c is AddChange {
  return c.kind === 'remove';
}
export function isUnchanged(c: Change): c is AddChange {
  return c.kind === 'unchanged';
}

export function diffByChars(stra: string, strb: string, opts?: DiffCharsArgs): Change[] {
  const brief = opts && opts.brief;
  const changes = Diff.diffChars(stra, strb);
  const asPairs = _.map(changes, (change) => _.toPairs(change));
  const filterUndefs = _.map(asPairs, change => _.filter(change, ([,v]) => !_.isNil(v)));
  const asObjects = _.map(filterUndefs, change => Object.fromEntries(change));
  return _.map(asObjects, obj => {
    const { added, removed, count, value } = obj;
    if (added) return ({ kind: 'add', value, count });
    if (removed) return ({ kind: 'remove', value, count });
    if (brief) return ({ kind: 'unchanged', count });
    return ({ kind: 'unchanged', value, count });
  });
}
