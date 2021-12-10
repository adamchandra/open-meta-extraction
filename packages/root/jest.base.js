const { pathsToModuleNameMapper } = require("ts-jest");
const { compilerOptions } = require("../../tsconfig.json");

function rootPath(pk, relpath) {
  const packagePath = pk.name.split('/')[1];
  if (relpath) {
    return ['<rootDir>', '..', packagePath, relpath].join('/');
  }
  return ['<rootDir>', '..', packagePath].join('/');
}

function makeConfig(modulePackage) {
  const displayName = modulePackage.name;
  // console.log({ displayName })
  const packagePath = displayName.split('/')[1];

  const moduleMap = pathsToModuleNameMapper(compilerOptions.paths, {
    // This has to match the baseUrl defined in tsconfig.json.
    prefix: "<rootDir>/../..",
  });
  const tildePathMap = rootPath(modulePackage, 'src/$1');
  // const tildePathMap = rootPath(modulePackage, 'src');
  const tsconfig = rootPath(modulePackage, 'tsconfig.json');
  // const tsconfig = `<rootDir>/../${packagePath}/tsconfig.json`
  const pkgRoot = rootPath(modulePackage);
  const config = {
    preset: 'ts-jest',
    rootDir: '../eslint-config/',
    // roots: [pkgRoot],
    roots: ['<rootDir>/../..'],
    displayName,
    transform: {
      "^.+\\.ts$": "ts-jest",
    },
    testRegex: ".*\\.test\\.ts$",
    moduleNameMapper: {
      ...moduleMap,
      "^~/(.*)$": tildePathMap,
      // "^~$": tildePathMap,
    },
    moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json", "node"],
    globals: {
      'ts-jest': {
        tsconfig,
        diagnostics: false
      }
    },
  };
  console.log({ config })
  return config;
}

module.exports = {
  makeConfig
};
