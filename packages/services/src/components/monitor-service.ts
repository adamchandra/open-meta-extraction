import { getServiceLogger, isTestingEnv } from '@watr/commonlib';
import { formatStatusMessages, showStatusSummary } from '~/db/extraction-summary';
import { connectToMongoDB } from '~/db/mongodb';
import { OpenReviewGateway } from '~/components/openreview-gateway';


type Args = {
  sendNotification: boolean,
};

export async function runMonitor({
  sendNotification
}: Args) {
  const log = getServiceLogger('MonitorService');
  log.info('Running Monitor');

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
  const shouldPost = sendNotification && !isTestingEnv();
  if (shouldPost) {
    log.info('Sending Email Notification');
    await gateway.postStatusMessage(subject, message);
    return;
  }
  log.warn('No monitor notification sent');
}
