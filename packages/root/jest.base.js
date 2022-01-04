
function rootPath(packagePath, relpath) {
  if (relpath) {
    return ['<rootDir>', packagePath, relpath].join('/');
  }
  return ['<rootDir>', packagePath].join('/');
}

function makeConfig(modulePackage) {
  const moduleRoot = '.'
  const displayName = modulePackage.name;

  const tildePathMap = rootPath(moduleRoot, 'src/$1');
  const tsconfig = rootPath(moduleRoot, 'tsconfig.json');

  const config = {
    preset: 'ts-jest',
    rootDir: '.',
    roots: ['<rootDir>/src'],
    displayName,
    testRegex: ".*\\.test\\.ts$",
    moduleNameMapper: {
      "^~/(.*)$": tildePathMap,
    },
    testRunner: "jest-jasmine2",
    moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json", "node"],
    globals: {
      'ts-jest': {
        tsconfig,
        diagnostics: false,
        isolatedModules: false,
        noEmit: true
      }
    },
  };
  return config;
}

module.exports = {
  makeConfig
};
