const { pathsToModuleNameMapper } = require("ts-jest");
const { compilerOptions } = require("../../tsconfig.json");

function rootPath(packagePath, relpath) {
  if (relpath) {
    return ['<rootDir>', packagePath, relpath].join('/');
  }
  return ['<rootDir>', packagePath].join('/');
}

function makeConfig(modulePackage, local=false) {
  // const modulePackagePath = [moduleRoot, 'package.json'].join('/');
  // const modulePackage = require(modulePackagePath);
  const moduleRoot = '.'
  const displayName = modulePackage.name;

  const moduleMap = pathsToModuleNameMapper(compilerOptions.paths, {
    // This has to match the baseUrl defined in tsconfig.json.
    prefix: "<rootDir>/../..",
  });
  const tildePathMap = rootPath(moduleRoot, 'src/$1');
  const tsconfig = rootPath(moduleRoot, 'tsconfig.json');
  const pkgRoot = rootPath(moduleRoot);
  const config = {
    preset: 'ts-jest',
    rootDir: '.',
    // roots: [pkgRoot],
    roots: ['<rootDir>/src'],
    // resolver: '<rootDir>/resolver.js',
    displayName,
    // transform: {
    //   "^.+\\.ts$": "ts-jest",
    // },
    testRegex: ".*\\.test\\.ts$",
    moduleNameMapper: {
      // ...moduleMap,
      "^~/(.*)$": tildePathMap,
    },
    moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json", "node"],
    // transformIgnorePatterns: [ "commonlib" ],
    globals: {
      'ts-jest': {
        tsconfig,
        diagnostics: false,
        isolatedModules: false,
        noEmit: true
      }
    },
  };
  console.log({ config })
  return config;
}

module.exports = {
  makeConfig
};
