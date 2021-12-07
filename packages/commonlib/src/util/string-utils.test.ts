// import 'chai';

import _ from 'lodash';

import { diffByChars } from './string-utils';

// import { diffChars, Change } from 'diff';
import { prettyPrint } from './pretty-print';

describe('String utils', () => {
  // it('should apply cleaning and hightlight', () => {

  //   const input = 'some random string';

  //   let matches = matchAll(/om/g, input);
  //   let result = highlightRegions(input, matches);
  //   console.log(result);

  //   // matches = matchAll(/o../g, input);
  //   // result = highlightRegions(result, matches)
  //   // console.log(result);

  //   matches = matchAll(/n.*n/g, input);
  //   result = highlightRegions(result, matches)
  //   console.log(result);
  // });

  // it.only('clip paragraphs', () => {
  //   const p = 'ab cd ef gh ij'
  //   // const p = ""
  //   const result = clipParagraph(3, 2, p);

  //   console.log(result);
  // });

  it.only('should diff strings', () => {
    const stra = 'the cat in the hat';
    const strb = 'The cat   in the hatchet. [Extra]';
    const diff1 = diffByChars(stra, strb, { brief: true });
    const diff2 = diffByChars(stra, strb, { brief: false });
    const diff3 = diffByChars(stra, strb,);

    prettyPrint({ diff1, diff2, diff3 });
  });
});
