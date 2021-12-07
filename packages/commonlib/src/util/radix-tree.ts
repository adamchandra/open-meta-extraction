import _ from 'lodash';

export type Radix<T> = { [s: string]: Radix<T> | T };
export type RadixPath = string[];

const RadixValKey = '_$';

export const createRadix = <T>(): Radix<T> => ({} as Radix<T>);

function cleanPath(p: string | string[]): string[] {
  let pathParts: string[];
  pathParts = typeof p === 'string' ? p.split('.') : p;
  return _.map(pathParts, pp => {
    const part = pp.trim();
    if (/^(\d+|_\$)$/.test(part)) {
      return `_${part}`;
    }
    return part;
  }).filter(p => p.length > 0);
}


export const radUpsert = <T>(
  radix: Radix<T>,
  path: string | string[],
  f: (t?: T) => T,
): void => {
  const valpath = [...cleanPath(path), RadixValKey];
  const prior = _.get(radix, valpath);
  const upVal = f(prior);
  _.set(radix, valpath, upVal);
};


export const radInsert = <T>(radix: Radix<T>, path: string | string[], t: T): void => radUpsert(radix, path, () => t);

export const radGet = <T>(
  radix: Radix<T>,
  path: string | string[],
): T | undefined => {
  const valpath = [...cleanPath(path), RadixValKey];
  const v: T | undefined = _.get(radix, valpath);
  return v;
};

export const radTraverseValues = <T>(
  radix: Radix<T>,
  f: (path: RadixPath, t: T) => void,
): void => {
  function _loop(rad: Radix<T>, lpath: string[]) {
    const kvs = _.toPairs(rad);
    _(kvs).each(([k, v]) => {
      if (k === RadixValKey) {
        f(lpath, v as T);
      } else {
        const newpath = _.concat(lpath, k);
        _loop(rad[k] as Radix<T>, newpath);
      }
    });
  }
  _loop(radix, []);
};

