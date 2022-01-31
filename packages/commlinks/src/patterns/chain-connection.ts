import _ from 'lodash';
import { cyield, Message } from '~/core/message-types';

import { CommLink } from '~/core/commlink';

export function chainServices<S>(
  functionName: string,
  commLinks: CommLink<S>[]
): void {
  const serviceNames = _.map(commLinks, c => c.name);

  _.each(commLinks, (commLink, n) => {
    const isLastService = n === commLinks.length - 1;
    const nextService = serviceNames[n + 1];

    if (!isLastService) {
      commLink.on(cyield(functionName), async (msg: Message) => {
        if (msg.kind !== 'cyield') return;
        const r = await commLink.call(functionName, msg.value, { to: nextService });
        return { ...msg, value: r };
      });
    }

  });
}

export interface CallChain {
  chainFunction: string;
  orderedServices: string[];
}

// export function initCallChaining<T>(this: CommLink<T>, arg: CallChain): void {
//   const { name } = this;
//   const { chainFunction, orderedServices } = arg;
//   const i = orderedServices.indexOf(name);
//   const serviceNotFound = i < 0;
//   const isLastService = i === orderedServices.length - 1;
//   const nextService = orderedServices[i + 1];
//   if (serviceNotFound) {
//     return;
//   }
//   if (isLastService) {
//     return;
//   }
//   this.commLink.on(cyield(chainFunction), async (msg: Message) => {
//     if (msg.kind !== 'cyield') return;
//     const r = await this.commLink.call(chainFunction, msg.value, { to: nextService });
//     return { ...msg, value: r };
//   });

// }
