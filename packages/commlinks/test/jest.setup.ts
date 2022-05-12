import { initConfig } from "@watr/commonlib";

jest.setTimeout(40000); // in milliseconds
process.env['NODE_ENV'] = 'test';

initConfig();
