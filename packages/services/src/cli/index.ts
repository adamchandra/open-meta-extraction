import { arglib } from '@watr/commonlib';
import '~/http-servers/rest-portal/rest-server';
import '~/workflow/workflow-cli';


arglib.YArgs
  .demandCommand(1, 'You need at least one command before moving on')
  .strict()
  .help()
  .fail((err) => {
    console.log('Error', err);
    arglib.YArgs.showHelp();
  })
  .argv;
