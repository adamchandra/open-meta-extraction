import { arglib, putStrLn } from '@watr/commonlib';

import * as workflowCmds from '~/workflow/workflow-cli';
import * as scheduling from '~/pm2/scheduling-services';
import { spiderCLI } from '@watr/spider';
import { fieldExtractorCLI } from '@watr/field-extractors';

export function registerAllClis() {
  workflowCmds.registerCLICommands(arglib.YArgs);
  scheduling.registerCommands(arglib.YArgs);
  spiderCLI.registerCommands(arglib.YArgs);
  fieldExtractorCLI.registerCommands(arglib.YArgs);
}

export async function runCli() {
  const runResult = arglib.YArgs
    .demandCommand(1, 'You need at least one command before moving on')
    .strict()
    .help()
    .fail((msg, err, yargs) => {
      let errorMessage = `Error:
      ${msg}
      `;

      if (err !== undefined) {
        errorMessage += `
        Error was: ${err}
        `;
      }
      putStrLn(errorMessage)
      arglib.YArgs.showHelp();
      process.exit(1);
    })
    .argv;

  return Promise.resolve(runResult);
}
