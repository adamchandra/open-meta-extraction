import { registerAllClis, runCli } from '~/cli/runner';
import { runJob } from '../pm2-helpers';


(async () => runJob(__filename, async () => {
  registerAllClis();
  await runCli();
}))();
