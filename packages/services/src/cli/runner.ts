import { arglib } from '@watr/commonlib';

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
      // console.log('RunCLI Error (svc)', msg, err, yargs);
      arglib.YArgs.showHelp();
    })
    .argv;
  return Promise.resolve(runResult);
}
