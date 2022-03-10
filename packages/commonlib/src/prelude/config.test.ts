import _ from 'lodash';
import { prettyPrint } from '~/util/pretty-print';
import { configureApp, initConfig } from './config';

describe('Configuration Management', () => {
  it('read base config+secrets', () => {
      process.env['workingDirectory'] = './test.tmp.d';
      // const conf = configureApp();
      const conf = initConfig();
      const api = conf.get('openreview:restApi');
      const pass = conf.get('openreview:restPassword');
      prettyPrint({ api, pass });
  });
});
