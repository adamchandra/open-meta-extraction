import _ from 'lodash';
import { findAncestorFile } from './config';

describe('Configuration Management', () => {
  type ExampleT = Parameters<typeof findAncestorFile>;
  it('find ancestor file', () => {

    const examplesUndef: ExampleT[] = [
      ['.', 'foobar', ['conf', '.']],
      ['no/path', 'foobar', ['conf', '.']],
    ];

    const examplesDef: ExampleT[] = [
      ['..', 'tsconfig.json', ['conf', '.']],
      ['.', 'jest.setup.ts', ['test', '.']],
    ];

    _.each(examplesUndef, ex => {
      const result = findAncestorFile(...ex);
      expect(result).toBeUndefined();
    });
    _.each(examplesDef, ex => {
      const result = findAncestorFile(...ex);
      expect(result).toBeDefined();
    });

  });

  it('read base config+secrets', () => {
    process.env['workingDirectory'] = './test.tmp.d';
    // const conf = configureApp();
    // const conf = initConfig();
    // const api = conf.get('openreview:restApi');
    // const pass = conf.get('openreview:restPassword');
    // prettyPrint({ api, pass });
  });

});
