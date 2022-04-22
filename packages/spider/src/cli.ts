import { arglib, prettyPrint } from '@watr/commonlib';
import { initScraper } from './scraper';
const { opt, config, registerCmd } = arglib;

export function registerCommands(yargv: arglib.YArgsT) {
  registerCmd(
    yargv,
    'spider-url',
    'spider the give URL, save results in corpus',
    config(
      // opt.cwd,
      opt.existingDir('corpus-root: root directory for corpus files'),
      opt.ion('url', {
        type: 'string',
        required: true
      }),
    )
  )(async (args: any) => {
    console.log(`running spider-url`)
    process.env['service-comm.loglevel'] = 'debug';
    const { url, corpusRoot } = args;
    const sharedDataDir = '.';

    const scraper = await initScraper({ corpusRoot, sharedDataDir });
    const scrapedUrl = await scraper.scrapeUrl(url, /*clean=*/ true);

    prettyPrint({ scrapedUrl })

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
