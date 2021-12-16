import { arglib } from '@watr/commonlib';
import '~/http-servers/extraction-rest-portal/rest-server';
import '~/workflow/workflow-cli';
import './extraction-cli';

arglib.YArgs
  .demandCommand(1, 'You need at least one command before moving on')
  .strict()
  .help()
  .fail((err) => {
    console.log('Error', err);
    arglib.YArgs.showHelp();
  })
  .argv;
