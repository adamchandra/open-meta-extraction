import { getServiceLogger, initConfig } from '@watr/commonlib';
import { parentPort } from 'worker_threads';
import { runJob } from '../pm2-helpers';

runJob(__filename, async (logger, workerData: any) => {
  const log = getServiceLogger('PreflightChecks');
  log.info('Checking Configuration');
  let errorStatus = 'ok';

  try {
    initConfig();
  } catch {
    errorStatus = 'error';
  }

  if (parentPort) {
    parentPort.postMessage(`preflight-${errorStatus}`);
  }
});
