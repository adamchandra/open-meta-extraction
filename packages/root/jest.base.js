// const preset = require('ts-jest/presets').jsWithTsESM;

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
    testEnvironment: 'node',
    bail: true,
    verbose: true,
    maxWorkers: 1, // forces serial execution
    rootDir: '.',
    roots: ['<rootDir>/src'],
    displayName,
    testRegex: ".*\\.test\\.ts$",
    moduleNameMapper: {
      "^~/(.*)$": tildePathMap,
    },
    transform: {
      "\\.tsx?$": "ts-jest"
    },
    testRunner: "jest-jasmine2",
    moduleFileExtensions: ["ts", "js", "json", "node"],
    setupFilesAfterEnv: ['./test/jest.setup.ts'],
    globals: {
      'ts-jest': {
        tsconfig,
        diagnostics: true,
        isolatedModules: false,
        noEmit: true,
        useESM: true
      }
    },
  };
  return config;
}

module.exports = {
  makeConfig
};
