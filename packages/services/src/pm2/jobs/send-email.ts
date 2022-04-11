import { runJob } from '../pm2-helpers';

runJob(__filename, (logger, workerData: any) => {
    const { messageBody } = workerData;

});
