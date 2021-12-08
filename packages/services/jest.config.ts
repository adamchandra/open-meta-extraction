/* eslint-disable import/no-extraneous-dependencies */
// import type { Config } from '@jest/types';
// import { pathsToModuleNameMapper } from "ts-jest/utils";
// // Load the config which holds the path aliases.
// // import { compilerOptions } from "../../tsconfig.json";

// // const allPaths = Object.assign({}, compilerOptions.paths, {
// //   "~/*": ["src/*"]
// // });
// import 'ts-jest';
// const config: Config.InitialOptions = {
//   preset: 'ts-jest',
//   roots: [
//     "<rootDir>/src"
//   ],
//   resolver: './resolver.js',


//   // moduleNameMapper: pathsToModuleNameMapper(allPaths, {
//   //   // This has to match the baseUrl defined in tsconfig.json.
//   //   prefix: "<rootDir>/../../",
//   // }),
// };

// export default config;

// const { pathsToModuleNameMapper } = require("ts-jest");
// const { compilerOptions } = require("./tsconfig.json");
// module.exports = {
//   preset: "ts-jest",

//   moduleNameMapper: pathsToModuleNameMapper(compilerOptions.paths, {
//     // This has to match the baseUrl defined in tsconfig.json.
//     prefix: "<rootDir>",
//   })
// };
import * as baseConfig from "../eslint-config/jest.base";
import pkg from './package.json';

module.exports = {
  ...baseConfig,
  displayName: pkg.name,
  rootDir: '../eslint-config',
  globals: {
    'ts-jest': {
      tsConfig: './tsconfig.json'
    }
  },
  // setupFilesAfterEnv: ['@testing-library/react/cleanup-after-each'],
  // snapshotSerializers: ['jest-emotion']
};
