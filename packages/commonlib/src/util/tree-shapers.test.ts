import _ from 'lodash';
import * as Tree from 'fp-ts/lib/Tree';
import { Edges, makeTreeFromPairs } from './tree-shapers';
import { stripMargin } from './string-utils';

describe('Tree Creation', () => {
  it('smokescreen', () => {
    const graphPairs: Edges<number> = [
      [10, 11],
      [10, 12],
      [11, 13],
      [11, 14],
      [12, 15]
    ];

    const expected = (`
|10
|├─ 11
|│  ├─ 13
|│  └─ 14
|└─ 12
|   └─ 15
`);
    const expectedTree = stripMargin(expected).trim();

    const trees = makeTreeFromPairs(graphPairs);
    _.each(trees, tree => {
      const stringTree = Tree.map((n) => `${n}`)(tree);
      const asString = Tree.drawTree(stringTree);
      expect(asString).toEqual(expectedTree);
    });
  });

  it('should create distinct, unconnected trees', () => {
    const graphPairs: Edges<number> = [
      [0, 1],
      [0, 2],
      [1, 3],
      [1, 4],
      [2, 5],
      [10, 11],
      [20, 21]
    ];

    const trees = makeTreeFromPairs(graphPairs);
    expect(trees).toHaveLength(3);
  });

  it('should create a right-slanting list', () => {
    const graphPairs: Edges<number> = [
      [0, 1],
      [1, 2],
      [2, 3],
    ];
    const expected = (`
|0
|└─ 1
|   └─ 2
|      └─ 3
|`);
    const expectedTree = stripMargin(expected).trim();
    const trees = makeTreeFromPairs(graphPairs);
    _.each(trees, tree => {
      const stringTree = Tree.map((n) => `${n}`)(tree);
      const asString = Tree.drawTree(stringTree);
      expect(asString).toEqual(expectedTree);
    });
  });

  it('not care about input order', () => {
    const graphPairs: Edges<number> = [
      [1, 2],
      [0, 1],
      [2, 3],
    ];
    const expected = (`
|0
|└─ 1
|   └─ 2
|      └─ 3
|`);
    const expectedTree = stripMargin(expected).trim();
    const trees = makeTreeFromPairs(graphPairs);
    _.each(trees, tree => {
      const stringTree = Tree.map((n) => `${n}`)(tree);
      const asString = Tree.drawTree(stringTree);
      expect(asString).toEqual(expectedTree);
    });
  });

  it('should fix bug #???', () => {
    const graphPairs: Edges<number> = [
      [41, 42],
      [42, 43],
      [43, 44],
      [44, 45],
      [42, 47],
      [43, 48],
      [42, 49]
    ];

    const expected = (
      `|41
       |└─ 42
       |   ├─ 43
       |   │  ├─ 44
       |   │  │  └─ 45
       |   │  └─ 48
       |   ├─ 47
       |   └─ 49
       |`);

    const expectedTree = stripMargin(expected).trim();

    const trees = makeTreeFromPairs(graphPairs);
    _.each(trees, tree => {
      const stringTree = Tree.map((n) => `${n}`)(tree);
      const asString = Tree.drawTree(stringTree);
      expect(asString).toEqual(expectedTree);
    });
  });
});
