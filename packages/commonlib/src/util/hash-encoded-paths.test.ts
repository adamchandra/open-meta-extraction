import _ from 'lodash';
import { makeHashEncodedPath } from './hash-encoded-paths';

describe('Hash Encoded Paths', () => {
  it('should create hash-encoded paths of specified depth', () => {
    const examples = [
      'http://example.com',
      'qwerty',
    ];
    _.each(examples, example => {
      _.each(_.range(2, 4), (n) => {
        const encPath = makeHashEncodedPath(example, n);
        const asPath = encPath.toPath();
        expect(encPath.leadingSegments.length).toEqual(n);
        expect(
          asPath.startsWith(
            encPath.leadingSegments.join('/')
          )
        ).toEqual(true);
      });
    });
  });
});
