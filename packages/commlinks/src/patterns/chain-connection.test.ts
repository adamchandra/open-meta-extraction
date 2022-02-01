import _ from 'lodash';
import { initCallChaining, createCommChain } from './chain-connection';

import { awaitQuit, initCommLinks } from '~/util/service-test-utils';
import { CommLink } from '~/core/commlink';
import { prettyPrint } from '@watr/commonlib';

describe('Chained CommLink Connection Patterns', () => {
  process.env['service-comm.loglevel'] = 'info';

  interface CallState {
    clientFuncs: string[];
  }

  it('should setup chain-calling pattern', async (done) => {
    const Client = {
      initCallChaining,
      async func1(callState: CallState, commLink: CommLink<typeof Client>): Promise<CallState> {
        callState.clientFuncs.push(`${commLink.name}.func1()`)
        return callState;
      }
    };
    const commLinks = await initCommLinks<typeof Client>(5, () => Client)
    const commNames = _.map(commLinks, (cl) => cl.name)

    const [comm0, comm1] = commLinks;

    const chainResult = await createCommChain(comm0, 'func1', commNames);
    prettyPrint({ chainResult })

    const ret1 = await comm0.call('func1', { clientFuncs: [] }, { to: comm1.name });

    const expected = [
      'commLink-1.func1()',
      'commLink-2.func1()',
      'commLink-3.func1()',
      'commLink-4.func1()'
    ];

    expect(ret1.clientFuncs).toStrictEqual(expected);

    await awaitQuit(commLinks)
    done();
  });
});
