const { pathsToModuleNameMapper } = require("ts-jest");
const { compilerOptions } = require("../../tsconfig.json");

function rootPath(pk, relpath) {
  const packagePath = pk.name.split('/')[1];
  console.log({ packagePath })
  if (relpath) {
    return ['<rootDir>', '..', packagePath, relpath].join('/');
  }
  return ['<rootDir>', '..', packagePath].join('/');
}

function makeConfig(modulePackage) {
  const displayName = modulePackage.name;

  const moduleMap = pathsToModuleNameMapper(compilerOptions.paths, {
    // This has to match the baseUrl defined in tsconfig.json.
    prefix: "<rootDir>/..",
  });
  const tildePathMap = rootPath(modulePackage, 'src/$1');
  const tsconfig = rootPath(modulePackage, 'tsconfig.json');
  const pkgRoot = rootPath(modulePackage);
  const config = {
    rootDir: '../eslint-config',
    roots: [pkgRoot],
    displayName,
    transform: {
      "^.+\\.ts$": "ts-jest",
    },
    testRegex: ".*\\.test\\.ts$",
    moduleNameMapper: {
      ...moduleMap,
      "^~/(.*)$": tildePathMap,
    },
    moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json", "node"],
    globals: {
      'ts-jest': {
        tsconfig
      }
    },
  };

  console.log({ config })
  return config;
}

module.exports = {

  makeConfig
  // transform: {
  //   "^.+\\.ts$": "ts-jest",
  // },
  // testRegex: ".*\\.test\\.ts$",
  // moduleNameMapper: pathsToModuleNameMapper(compilerOptions.paths, {
  //   // This has to match the baseUrl defined in tsconfig.json.
  //   prefix: "<rootDir>/../..",
  // }),
  // moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json", "node"],
};
