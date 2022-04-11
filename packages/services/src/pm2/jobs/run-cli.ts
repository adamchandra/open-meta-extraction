import { registerAllClis, runCli } from '~/cli/runner';
import { runJob } from '../pm2-helpers';

runJob(__filename, () => {
    registerAllClis();
    runCli();
});
