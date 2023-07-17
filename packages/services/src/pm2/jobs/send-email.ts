import { getServiceLogger, isTestingEnv } from '@watr/commonlib';
import { formatStatusMessages, showStatusSummary } from '~/db/extraction-summary';
import { connectToMongoDB } from '~/db/mongodb';
import { runJob } from '../pm2-helpers';
import { OpenReviewGateway } from '~/components/openreview-gateway';


runJob(__filename, async (logger, workerData: any) => {
  const log = getServiceLogger('SendEMail');
  log.info('Sending Email Notification');

  const mongoose = await connectToMongoDB();
  const summaryMessages = await showStatusSummary();
  const formattedSummary = formatStatusMessages(summaryMessages);
  await mongoose.connection.close();

  const gateway = new OpenReviewGateway();

  const subject = 'OpenReview Extraction Service Status';
  const message = formattedSummary;
  log.info('Email:');
  log.info(`  subject: ${subject}`);
  log.info(message);
  if (isTestingEnv()) {
    log.warn('Testing Env; no email sent');
    return;
  }
  await gateway.postStatusMessage(subject, message);
});
