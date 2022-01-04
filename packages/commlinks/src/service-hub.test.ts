import _ from 'lodash';

import { assertAllStringsIncluded, createTestServiceHub } from './service-test-utils';

describe('Service Communication Hub lifecycle', () => {
  process.env['service-comm.loglevel'] = 'info';

  it('should startup, link, and shutdown service hub with satellites', async (done) => {
    const logMessages: string[] = [];
    const numServices = 3;
    const expectedMessages = _.flatMap(_.range(numServices), svcNum => {
      return [
        `service-${svcNum}:ServiceHub>ping`,
        `ServiceHub:service-${svcNum}>ack/ping`,
        `service-${svcNum}:ServiceHub>quit`,
        `ServiceHub:service-${svcNum}>ack/quit`,
      ];
    });

    const [hub, connectHub] = await createTestServiceHub(numServices, logMessages);
    await connectHub();

    await hub.shutdownSatellites();

    await hub.commLink.quit();

    const receivedAllExpectedMessages = assertAllStringsIncluded(expectedMessages, logMessages);
    expect(receivedAllExpectedMessages).toBe(true);
    done();
  });
});
