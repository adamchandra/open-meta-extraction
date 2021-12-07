import _ from 'lodash';

import { arglib } from '@watr/commonlib';
import { runMainExtractFields, runMainInitFilters } from '~/extract/run-main';

const { opt, config, registerCmd } = arglib;

registerCmd(
  arglib.YArgs,
  'show-extractor-stats',
  'run field extractors',
  config(
    opt.cwd,
    opt.existingDir('corpus-root: root directory for corpus files'),
  )
)((args: any) => {
  const { corpusRoot } = args;

  runMainInitFilters(
    corpusRoot,
  ).then(() => {
    console.log('done');
  });
});

registerCmd(
  arglib.YArgs,
  'run-field-extractors',
  'run field extractors',
  config(
    opt.cwd,
    opt.existingDir('corpus-root: root directory for corpus files'),
    opt.ion('drop', {
      type: 'number',
      required: false,
      default: 0
    }),
    opt.ion('take', {
      type: 'number',
      required: false,
      default: Number.MAX_SAFE_INTEGER,
    }),
    opt.ion('log-level', {
      required: false,
      default: 'info'
    }),
    opt.ion('path-filter', {
      type: 'string',
      required: false,
      default: '.*'
    }),
    opt.ion('url-filter', {
      type: 'string',
      required: false,
      default: '.*'
    }),
  )
)((args: any) => {
  const { corpusRoot, logLevel, drop, take, pathFilter, urlFilter } = args;
  const logpath = corpusRoot;

  runMainExtractFields(
    corpusRoot,
    logpath,
    logLevel,
    drop,
    take,
    pathFilter,
    urlFilter
  ).then(() => {
    console.log('done');
  });
});
