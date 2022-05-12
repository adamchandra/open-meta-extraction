import { arglib } from '@watr/commonlib';

import * as workflowCmds from '~/workflow/workflow-cli';
import * as scheduling from '~/pm2/scheduling-services';

export function registerAllClis() {
    workflowCmds.registerCLICommands(arglib.YArgs);
    scheduling.registerCommands(arglib.YArgs);
}

export async function runCli() {
    const runResult = arglib.YArgs
        .demandCommand(1, 'You need at least one command before moving on')
        .strict()
        .help()
        .fail((err) => {
            console.log('RunCLI Error', err);
            arglib.YArgs.showHelp();
        })
        .argv;
    return Promise.resolve(runResult);
}
