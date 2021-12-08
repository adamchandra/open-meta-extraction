const { pathsToModuleNameMapper } = require("ts-jest");
const { compilerOptions } = require("../../tsconfig.json");

module.exports = {
  transform: {
      "^.+\\.ts$": "ts-jest",
  },
  testRegex: ".*\\.test\\.ts$",
  moduleNameMapper: pathsToModuleNameMapper(compilerOptions.paths, {
    // This has to match the baseUrl defined in tsconfig.json.
    prefix: "<rootDir>/../..",
  }),
  moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json", "node"],
};
