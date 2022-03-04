import _ from 'lodash';
import { initCallChaining as initCC, createCommChain, CallChainingArgs } from './chain-connection';

import { awaitQuit, initCommLinks } from '~/util/service-test-utils';
import { CommLink } from '~/core/commlink';
import { CustomHandlers } from '~/core/message-types';
import { prettyPrint } from '@watr/commonlib';

describe('Chained CommLink Connection Patterns', () => {
  process.env['service-comm.loglevel'] = 'info';

  interface CallState {
    clientFuncs: string[];
  }
  interface ClientData {
  }


  interface Client extends CustomHandlers<ClientData> {
    initCallChaining(arg: CallChainingArgs, commLink: CommLink<ClientData>): Promise<CallChainingArgs>;
    func1(callState: CallState, commLink: CommLink<ClientData>): Promise<CallState>;
  }

  it('should setup chain-calling pattern', async () => {
    const client: Client = {
      async initCallChaining(arg, commLink) {
        // prettyPrint({ m: 'initCallChaining', arg })
        return initCC(arg, commLink);
      },
      async func1(callState: CallState, commLink: CommLink<ClientData>): Promise<CallState> {
        // prettyPrint({ m: 'func1', callState })
        callState.clientFuncs.push(`${commLink.name}.func1()`)
        return callState;
      }
    };
    const commLinks = await initCommLinks<Client>(5, () => client)
    const commNames = _.map(commLinks, (cl) => cl.name)

    const [comm0, comm1] = commLinks;

    const chainResult = await createCommChain(comm0, 'func1', commNames);

    const chainResultExpected = [
      'ok:commLink-0; #1/5',
      'ok:commLink-1; #2/5',
      'ok:commLink-2; #3/5',
      'ok:commLink-3; #4/5',
      'ok:commLink-4; #5/5; isLastService'
    ];
    expect(chainResult).toStrictEqual(chainResultExpected)

    const ret1 = await comm0.call<CallState, CallState>('func1', { clientFuncs: [] }, { to: comm1.name });

    const expected = [
      'commLink-1.func1()',
      'commLink-2.func1()',
      'commLink-3.func1()',
      'commLink-4.func1()'
    ];

    expect(ret1.clientFuncs).toStrictEqual(expected);

    await awaitQuit(commLinks)
  });
});
