import _ from 'lodash';
import { chainServices } from './chain-connection';

import { createTestServices } from '~/util/service-test-utils';

describe('Chained CommLink Connection Patterns', () => {
  process.env['service-comm.loglevel'] = 'silly';

  interface Client {
    run(msgArg: MsgArg): Promise<MsgArg>;
  }

  interface MsgArg {
    callees: string[];
    which: number;
  }


  it('should push message and promise response', async (done) => {
    const clients = _.map(_.range(2), clientNum => {
      const client: Client = {
        async run(msgArg: MsgArg): Promise<MsgArg> {
          msgArg.callees.push(`client#${clientNum+1}`);
          return msgArg;
        }
      };
      return client;
    });

    const testServices = await createTestServices<Client>(clients);
    const commLinks = _.map(testServices, ts => ts.commLink);

    chainServices('run', commLinks);

    const commLink0 = commLinks[0];

    const allChains = _.map(_.range(2), n => {
      const initMsg: MsgArg = {
        callees: [],
        which: n
      };

      return commLink0.call('run', initMsg);
    });

    await Promise.all(allChains)
      .then((results) => {
        const expected = [
          { callees: ['client#1', 'client#2'], which: 0 },
          { callees: ['client#1', 'client#2'], which: 1 }
        ];
        expect(results).toStrictEqual(expected);
      });


    const quitting = _.map(testServices, s => s.commLink.quit());
    await Promise.all(quitting);
    done();
  });

});
