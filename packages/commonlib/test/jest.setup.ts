import { initConfig } from '~/prelude/config';

jest.setTimeout(40000); // in milliseconds
process.env['NODE_ENV'] = 'testing';

initConfig();
