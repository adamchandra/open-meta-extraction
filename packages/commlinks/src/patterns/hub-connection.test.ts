import { prettyPrint } from '@watr/commonlib';
import _ from 'lodash';

import {
  assertAllStringsIncluded,
  createTestServiceHub
} from '~/util/service-test-utils';

describe('Service Communication Hub lifecycle', () => {
  process.env['service-comm.loglevel'] = 'info';

  it('should startup, link, and shutdown service hub with satellites', async (done) => {
    const logMessages: string[] = [];
    const numServices = 3;
    const expectedMessages = _.flatMap(_.range(numServices), svcNum => {
      return [
        `service-${svcNum}: {"kind":"ping","from":"ServiceHub","to":"service-${svcNum}"}`,
        `ServiceHub: {"kind":"ack","subk":"ping","from":"service-${svcNum}","to":"ServiceHub"}`,
        `service-${svcNum}: {"kind":"quit","from":"ServiceHub","to":"service-${svcNum}"}`,
        `ServiceHub: {"kind":"ack","subk":"quit","from":"service-${svcNum}","to":"ServiceHub"}`,
      ];
    });

    const [hub, connectHub] = await createTestServiceHub(numServices, logMessages);
    await connectHub();

    await hub.shutdownSatellites();

    await hub.commLink.quit();

    // prettyPrint({ expectedMessages, logMessages })
    const receivedAllExpectedMessages = assertAllStringsIncluded(expectedMessages, logMessages);
    expect(receivedAllExpectedMessages).toBe(true);
    done();
  });
});
