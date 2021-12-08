const baseConfig = require("../eslint-config/jest.base");
const pkg = require('./package.json');
// import { pathsToModuleNameMapper } from "ts-jest";
// import { compilerOptions } from "../../tsconfig.json";

module.exports = {
  ...baseConfig,
  displayName: pkg.name,
  rootDir: '../eslint-config',
  roots:['<rootDir>/../commonlib'],
  moduleNameMapper: {
    ...baseConfig.moduleNameMapper,
    // "^~/*": "<rootDir>/../commonlib/src/$1",
   "^~/(.*)$": "<rootDir>/../commonlib/src/$1",
  },
  globals: {
    'ts-jest': {
      tsconfig: '<rootDir>/../commonlib/tsconfig.json'
    }
  },
  // setupFilesAfterEnv: ['@testing-library/react/cleanup-after-each'],
  // snapshotSerializers: ['jest-emotion']
};

