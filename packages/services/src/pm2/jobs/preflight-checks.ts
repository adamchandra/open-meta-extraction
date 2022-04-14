import { runJob } from '../pm2-helpers';
import { getServiceLogger, initConfig } from '@watr/commonlib';
import { parentPort } from 'worker_threads';

runJob(__filename, async (logger, workerData: any) => {
    const log = getServiceLogger("PreflightChecks");
    log.info('Checking Configuration');
    let errorStatus = 'ok';

    try {
        initConfig();
    } catch(error) {
        errorStatus = 'error';
    }

    if (parentPort) {
        parentPort.postMessage(`preflight-${errorStatus}`);
    }
});
