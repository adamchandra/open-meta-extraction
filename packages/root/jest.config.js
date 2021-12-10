const { makeConfig } = require("./jest.base");

module.exports = {
  projects: [
    [ makeConfig('../commonlib') ] ,
    [ makeConfig('../spider') ],
    // makeConfig('../services/package.json')
  ]
};

