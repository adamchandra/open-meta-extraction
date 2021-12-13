import _ from 'lodash';

import { diffByChars } from './string-utils';
import { prettyPrint } from './pretty-print';

describe('String utils', () => {

  it('should diff strings', () => {
    const stra = 'the cat in the hat';
    const strb = 'The cat   in the hatchet. [Extra]';
    const diff1 = diffByChars(stra, strb, { brief: true });
    const diff2 = diffByChars(stra, strb, { brief: false });
    const diff3 = diffByChars(stra, strb,);

    prettyPrint({ diff1, diff2, diff3 });
  });
});
