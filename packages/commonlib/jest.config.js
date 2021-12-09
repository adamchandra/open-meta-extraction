// const baseConfig = require("../eslint-config/jest.base");
const { makeConfig } = require("../eslint-config/jest.base");
const pkg = require('./package.json');
// import { pathsToModuleNameMapper } from "ts-jest";
// import { compilerOptions } from "../../tsconfig.json";

// const pkgPath = pkg.name.split('/')[1];
// const pkgRoot = '<rootDir>/../'+pkgPath;
// console.log({ name: pkg.name, pkgPath })

module.exports = makeConfig(pkg, '<rootDir>');
// module.exports = {
//   ...baseConfig,
//   displayName: pkg.name,
//   rootDir: '../eslint-config',
//   roots:[pkgRoot],
//   moduleNameMapper: {
//     ...baseConfig.moduleNameMapper,
//    "^~/(.*)$": pkgRoot+"/src/$1",
//   },
//   globals: {
//     'ts-jest': {
//       tsconfig: pkgRoot+'/tsconfig.json'
//     }
//   },
//   // setupFilesAfterEnv: ['@testing-library/react/cleanup-after-each'],
//   // snapshotSerializers: ['jest-emotion']
// };
