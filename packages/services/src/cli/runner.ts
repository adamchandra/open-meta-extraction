import { arglib } from '@watr/commonlib';

import * as workflowCmds from '~/workflow/workflow-cli';
import * as coref from '~/workflow/distributed/openreview-coref';
import * as testCmds from '~/pm2/pm2-test-service';
import * as scheduling from '~/pm2/scheduling-services';

export function registerAllClis() {
    workflowCmds.registerCLICommands(arglib.YArgs);
    coref.registerCLICommands(arglib.YArgs);
    testCmds.registerCmds(arglib.YArgs);
    scheduling.registerCommands(arglib.YArgs);
}

export const CliPath = __dirname;

export function runCli() {
    arglib.YArgs
        .demandCommand(1, 'You need at least one command before moving on')
        .strict()
        .help()
        .fail((err) => {
            console.log('Error', err);
            arglib.YArgs.showHelp();
        })
        .argv;

}
