import _ from 'lodash';
import * as Tree from 'fp-ts/lib/Tree';

export type NodeType = number;
export type NodeList<NodeType> = NodeType[];
export type RoseList<NodeType> = readonly [NodeType, NodeList<NodeType>];
export type Edges<NodeType> = ReadonlyArray<[NodeType, NodeType]>;


export function makeTreeFromPairs<A extends NodeType>(paths: Edges<A>): Array<Tree.Tree<A>> {
  const parentChildPairs: RoseList<A>[] = _.flatMap(paths, ([parent, child]) => {
    const p: RoseList<A> = [parent, [child]];
    const c: RoseList<A> = [child, []];
    return [p, c];
  });

  const parentChildDict = new Map<A, A[]>();

  _.each(parentChildPairs, ([p, c]) => {
    const childs = parentChildDict.get(p) || [];
    childs.push(...c);
    parentChildDict.set(p, childs);
  });

  const parents: A[] = [];
  const inner: A[] = [];

  _.each(_.toPairs(parentChildDict), ([parent, children]) => {
    inner.push(...children);
    parents.push(parent as any as A);
  });

  const roots = _.difference(parents, inner);

  function mkTree(id: A): Tree.Tree<A> {
    const ns: NodeList<A> = parentChildDict.get(id) || [];
    const forest = _.map(ns, n => mkTree(n));
    return Tree.make(id, forest);
  }


  const allTrees = _.map(roots, root => mkTree(root));
  return allTrees;
}
