import _ from 'lodash';
import { cyield, Message } from '~/core/message-types';

import { CommLink } from '~/core/commlink';
import { prettyPrint } from '@watr/commonlib';

export interface CallChainDef {
  chainFunction: string;
  orderedServices: string[];
}

export interface CallChainingArgs extends CallChainDef {
  logs: string[];
}

export function callChainingArgs(chainFunction: string, orderedServices: string[]): CallChainingArgs {
  return { chainFunction, orderedServices, logs: [] };
}

export function initCallChaining<ClientT>(arg: CallChainingArgs, commLink: CommLink<ClientT>): CallChainingArgs {
  const { name } = commLink;

  const { chainFunction, orderedServices } = arg;
  const i = orderedServices.indexOf(name);
  const serviceNotFound = i < 0;
  const isLastService = i === orderedServices.length - 1;
  const nextService = orderedServices[i + 1];
  if (serviceNotFound) {
    arg.logs.push(`error:serviceNotFound for ${commLink.name} in service list ${orderedServices}`)
    return arg;
  }
  if (isLastService) {
    arg.logs.push(`ok:${name}; #${i + 1}/${orderedServices.length}; isLastService`);
    return arg;
  }

  commLink.on(cyield(chainFunction), async (msg: Message) => {
    if (msg.kind !== 'cyield') return;
    const retVal = msg.result;

    const r = await commLink.call(chainFunction, retVal, { id: msg.id, to: nextService });
    const output = { ...msg, result: r  };
    // prettyPrint({ hdr: 'callChaining.yield', messageIn: msg, fnRet: r, messageOut: output })
    return output;
  });

  arg.logs.push(`ok:${name}; #${i + 1}/${orderedServices.length}`);
  return arg;
}


export async function createCommChain<ClientT>(
  localComm: CommLink<ClientT>,
  chainFunction: string,
  orderedServices: string[]
): Promise<string[]> {

  const allLogs = await Promise.all(_.map(orderedServices, async (n) => {
    const res = await localComm.call<CallChainingArgs, CallChainingArgs>('initCallChaining', callChainingArgs(chainFunction, orderedServices), { to: n });
    return res.logs;
  }));

  return _.flatten(allLogs);
}
