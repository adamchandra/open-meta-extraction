import { arglib } from '@watr/commonlib';
import { registerCLICommands } from '~/workflow/workflow-cli';
import * as coref from '~/workflow/distributed/openreview-coref';

registerCLICommands(arglib.YArgs)
coref.registerCLICommands(arglib.YArgs)

arglib.YArgs
  .demandCommand(1, 'You need at least one command before moving on')
  .strict()
  .help()
  .fail((err) => {
    console.log('Error', err);
    arglib.YArgs.showHelp();
  })
  .argv;
