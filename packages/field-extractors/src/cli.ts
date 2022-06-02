import { arglib, prettyPrint, setLogEnvLevel } from '@watr/commonlib';

import { runMainExtractFromFile, runMainSpiderAndExtractFields } from '~/app/run-extraction';

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
      opt.flag('clean', false),
      opt.logLevel('info')
    )
  )(async (args: any) => {
    const { corpusRoot, url, clean, logLevel } = args;
    setLogEnvLevel(logLevel);
    prettyPrint({  args })
    await runMainSpiderAndExtractFields({
      corpusRoot,
      urlstr: url,
      clean
    });
  });

  registerCmd(
    yargv,
    'extract-urls',
    'spider and extract field from list of URLs in given file',
    config(
      opt.cwd,
      opt.existingDir('corpus-root: root directory for corpus files'),
      opt.flag('clean', false),
      opt.existingFile('url-file'),
      opt.logLevel('info')
    )
  )(async (args: any) => {
    const { corpusRoot, urlFile, clean, logLevel } = args;
    setLogEnvLevel(logLevel);
    prettyPrint({  args })

    await runMainExtractFromFile({
      corpusRoot,
      urlFile,
      clean
    });
  });
}

if (require.main === module) {
  registerCommands(arglib.YArgs);
  arglib.runRegisteredCmds(arglib.YArgs);
}
