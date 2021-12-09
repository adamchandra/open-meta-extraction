const { makeConfig } = require("../eslint-config/jest.base");
const pkg = require('./package.json');

module.exports = makeConfig(pkg, '<rootDir>');
