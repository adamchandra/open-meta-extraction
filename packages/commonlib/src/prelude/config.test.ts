import _ from 'lodash';
// import { prettyPrint } from '~/util/pretty-print';
import { findAncestorFile, initConfig } from './config';

describe('Configuration Management', () => {
  it('read base config+secrets', () => {
      process.env['workingDirectory'] = './test.tmp.d';
      // const conf = configureApp();
      const conf = initConfig();
      const api = conf.get('openreview:restApi');
      const pass = conf.get('openreview:restPassword');
      // prettyPrint({ api, pass });
  });

  it('find ancestor file', () => {

    const f1 = findAncestorFile('.', 'foobar');
    expect(f1).toBeUndefined();

    const f2 = findAncestorFile('ugh/what?', 'foobar');
    expect(f2).toBeUndefined();

    const f3 = findAncestorFile('..', 'tsconfig.json');
    expect(f3).toMatch(/tsconfig.json$/)

  })
});
