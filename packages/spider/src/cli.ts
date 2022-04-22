import { arglib, putStrLn } from '@watr/commonlib';
import { initScraper } from './scraper';
const { opt, config, registerCmd } = arglib;
import { isRight } from 'fp-ts/lib/Either';

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
    process.env['service-comm.loglevel'] = logLevel;
    const sharedDataDir = '.';

    const scraper = await initScraper({ corpusRoot, sharedDataDir });
    const scrapedUrl = await scraper.scrapeUrl(url, clean);

    await scraper.quit();
  });
}


export async function runCli() {
  registerCommands(arglib.YArgs);
  const runResult = arglib.YArgs
    .demandCommand(1, 'You need at least one command before moving on')
    .help()
    .fail((err) => {
      console.log('RunCLI Error', err);
      arglib.YArgs.showHelp();
    })
    .argv;
  return Promise.resolve(runResult);
}

runCli();
