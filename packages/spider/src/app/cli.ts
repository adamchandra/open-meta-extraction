import { arglib, setLogEnvLevel } from '@watr/commonlib';
const { opt, config, registerCmd } = arglib;

export function registerCommands(yargv: arglib.YArgsT) {
  registerCmd(
    yargv,
    'spider-url',
    'spider the give URL, save results in corpus',
    config(
      opt.existingDir('corpus-root: root directory for corpus files'),
      opt.str('url'),
      opt.flag('clean'),
      opt.logLevel('info'),
    )
  )(async (args: any) => {
    const { url, corpusRoot, clean, logLevel } = args;
    setLogEnvLevel(logLevel);

    // const scraper = await initScraper({ corpusRoot });
    // const scrapedUrl = await scraper.scrapeUrl(url, clean);

    // await scraper.quit();
  });
}

if (require.main === module) {
  registerCommands(arglib.YArgs);
  arglib.runRegisteredCmds(arglib.YArgs);
}
