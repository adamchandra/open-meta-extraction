import { registerAllClis, runCli } from './runner';

import 'source-map-support/register';

(async () => {
  registerAllClis();
  await runCli();
})();
