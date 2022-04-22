import { arglib, setLogEnvLevel } from '@watr/commonlib';

import { runMainExtractFields } from '~/app/run-extraction';

const { opt, config, registerCmd } = arglib;

export function registerCommands(yargv: arglib.YArgsT) {
  registerCmd(
    yargv,
    'extract-url',
    'spider and extract field from given URL',
    config(
      opt.cwd,
      opt.existingDir('corpus-root: root directory for corpus files'),
      opt.str('url'),
      opt.flag('clean'),
      opt.logLevel('info')
    )
  )(async (args: any) => {
    const { corpusRoot, url, clean, logLevel } = args;
    setLogEnvLevel(logLevel);

    await runMainExtractFields({
      corpusRoot,
      url,
      clean
    });
  });
}

if (require.main === module) {
  registerCommands(arglib.YArgs);
  arglib.runRegisteredCmds(arglib.YArgs)
}
