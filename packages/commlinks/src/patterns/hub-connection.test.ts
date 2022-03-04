import { prettyPrint } from '@watr/commonlib';
import _ from 'lodash';

import {
  assertAllStringsIncluded,
  createTestServiceHub
} from '~/util/service-test-utils';

describe('Service Communication Hub lifecycle', () => {
  process.env['service-comm.loglevel'] = 'info';

  it('should startup, link, and shutdown service hub with satellites', async () => {
    const logMessages: string[] = [];
    const numServices = 2;
    const expectedMessages = _.flatMap(_.range(numServices), n => {
      return [
        `ServiceHub -[ping]-> service-${n}`,
        `service-${n} -[ack]-> ServiceHub`,
        `service-${n} -[cyield]-> service-${n}`,
        `service-${n} -[creturn]-> ServiceHub`,
        `service-${n} -[cyield]-> service-${n}`,
        `service-${n} -[creturn]-> ServiceHub`,
        `service-${n} -[cyield]-> service-${n}`,
        `service-${n} -[creturn]-> ServiceHub`,
        `ServiceHub -[quit]-> service-${n}`,
        `service-${n} -[ack]-> ServiceHub`,
      ];
    });

    const [hub, connectHub] = await createTestServiceHub(numServices, logMessages);
    await connectHub();

    await hub.shutdownSatellites();

    await hub.commLink.quit();

    // prettyPrint({ expectedMessages, logMessages })
    const receivedAllExpectedMessages = assertAllStringsIncluded(expectedMessages, logMessages);
    expect(receivedAllExpectedMessages).toBe(true);
  });
});
