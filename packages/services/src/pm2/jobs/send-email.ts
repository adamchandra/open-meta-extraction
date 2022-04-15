import { getServiceLogger, isTestingEnv } from '@watr/commonlib';
import { newOpenReviewExchange } from '~/workflow/common/openreview-exchange';
import { runJob } from '../pm2-helpers';

runJob(__filename, async (logger, workerData: any) => {
    const log = getServiceLogger("SendEMail");
    log.info('Sending Email Notification');

    const orex = newOpenReviewExchange(log);
    const subject = 'OpenReview Extraction Service Status';
    const message = 'Service is online :)'
    log.info('Email:');
    log.info(`  subject: ${subject}`);
    log.info(`  message: ${message}`);
    if (isTestingEnv()) {
        log.warn('Testing Env; no email sent');
        return;
    }
    await orex.postStatusMessage(subject, message);

});
