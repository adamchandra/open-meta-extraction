import _ from 'lodash';

export type Primitive = string | boolean | number | null | undefined;

export type PathPart = string;
export type QualifiedKey = Readonly<[PathPart[]]>;
export type QualifiedKeyValue = Readonly<[PathPart[], Primitive]>;
export type QualifiedPath = QualifiedKey | QualifiedKeyValue;


// Indexed Qualified Paths
export interface IndexedPathPart {
  key: PathPart;
  index: number;
  siblingCount: number;
  container: 'arr' | 'obj';
}

export type IQualifiedKey = Readonly<[IndexedPathPart[]]>;
export type IQualifiedKeyValue = Readonly<[IndexedPathPart[], Primitive]>;
export type IQualifiedPath = IQualifiedKey | IQualifiedKeyValue;


export function isIQualifiedKey(qp: IQualifiedPath): qp is IQualifiedKey {
  return qp.length === 1;
}

export function isIQualifiedKeyValue(qp: IQualifiedPath): qp is IQualifiedKeyValue {
  return qp.length === 2;
}

export function isQualifiedKey(qp: QualifiedPath): qp is QualifiedKey {
  return qp.length === 1;
}

export function isQualifiedKeyValue(qp: QualifiedPath): qp is QualifiedKeyValue {
  return qp.length === 2;
}

export function getQualifiedKey(qp: QualifiedPath): QualifiedKey {
  return [qp[0]];
}

export function getQualifiedValue(qp: QualifiedPath): [Primitive] | undefined {
  if (isQualifiedKeyValue(qp)) {
    return [qp[1]];
  }
  return undefined;
}

export function toQualifiedPath(qp: IQualifiedPath): QualifiedPath {
  const qpath = _.map(qp[0], p => p.key);
  if (isIQualifiedKeyValue(qp)) {
    const v = qp[1];
    return [qpath, v];
  }
  return [qpath];
}

export function toQualifiedKeyValue(qp: IQualifiedPath): QualifiedKeyValue | undefined {
  const qpath = toQualifiedPath(qp);
  if (isQualifiedKeyValue(qpath)) {
    return qpath;
  }
  return undefined;
}

type ArgType = any;

/**
 * Recursively gather all paths and values in an object
 */
export function toIQualifiedPaths(obj: ArgType): IQualifiedPath[] {
  function _loop(
    subobj: any,
    parentPath: IndexedPathPart[]
  ): IQualifiedPath[] {
    if (_.isArray(subobj)) {
      const subPaths = _.flatMap(subobj, (entry, i) => {
        const pathPart: IndexedPathPart = {
          key: i.toString(),
          index: i,
          siblingCount: subobj.length,
          container: 'arr'
        };
        const subPath = _.concat(parentPath, pathPart);
        return _loop(entry, subPath);
      });

      return _.concat([[parentPath]], subPaths);
    }

    if (_.isObject(subobj)) {
      const kvs = _.toPairs(subobj);
      const subPaths = _.flatMap(kvs, ([k, v], i) => {
        const pathPart: IndexedPathPart = {
          key: k,
          index: i,
          siblingCount: kvs.length,
          container: 'obj'
        };
        const subPath = _.concat(parentPath, pathPart);
        return _loop(v, subPath);
      });
      return _.concat([[parentPath]], subPaths);
    }
    return [[parentPath, subobj]];
  }

  return _loop(obj, []).slice(1);
}

export function toQualifiedKeyValues(arg: ArgType): QualifiedKeyValue[] {
  const pvs = _.flatMap(
    toIQualifiedPaths(arg),
    qp => {
      const pvp = toQualifiedKeyValue(qp);
      if (pvp === undefined) return [];
      return [pvp];
    }
  );
  return pvs;
}
