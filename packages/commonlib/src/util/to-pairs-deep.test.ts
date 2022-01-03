import _ from 'lodash';
import { getQualifiedKey, getQualifiedValue, toIQualifiedPaths, toQualifiedKeyValues, toQualifiedPath } from './to-pairs-deep';

describe('toPairsDeep implementation', () => {
  const sampleRec: Record<string, any> = {
    quux: [
      {
        alpha: {
          omega: 1
        },
        crux: null,
        crax: undefined,
        gamma: {
          romeo: 'capulet',
          houses: 2,
        },
        baz: [
          {
            alpha: 'alpha',
            beta: 33,
          },
          'alpha',
          false,
        ]
      }
    ],
    bar: 'some bar value',
  };

  const expectedPathsWithValues = [
    [['quux', '0', 'alpha', 'omega'], 1],
    [['quux', '0', 'crux'], null],
    [['quux', '0', 'crax'], undefined],
    [['quux', '0', 'gamma', 'romeo'], 'capulet'],
    [['quux', '0', 'gamma', 'houses'], 2],
    [['quux', '0', 'baz', '0', 'alpha'], 'alpha'],
    [['quux', '0', 'baz', '0', 'beta'], 33],
    [['quux', '0', 'baz', '1'], 'alpha'],
    [['quux', '0', 'baz', '2'], false],
    [['bar'], 'some bar value']
  ];


  it('should create a list of all paths/values in object', () => {
    const examples = [
      sampleRec,
    ];

    _.each(examples, example => {
      const pathPairs = toIQualifiedPaths(example);
      _.each(pathPairs, (iqPath) => {
        const qpath = toQualifiedPath(iqPath);
        const [pathKey] = getQualifiedKey(qpath);
        const pathValue = getQualifiedValue(qpath);
        if (pathValue) {
          const recValue = _.get(example, pathKey);
          expect(recValue).toBe(pathValue[0]);
        }
      });
      const pathsWithValues = toQualifiedKeyValues(example);

      expect(pathsWithValues).toStrictEqual(expectedPathsWithValues);
    });
  });
});

