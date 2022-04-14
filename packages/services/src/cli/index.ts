import { registerAllClis, runCli } from './runner';

(async () => {
  registerAllClis();
  await runCli();
})();
