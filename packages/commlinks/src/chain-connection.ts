import _ from 'lodash';

import { CommLink } from './commlink';

import {
  Address,
  Dispatch,
  Yield,
  Yielded
} from './message-types';

export function chainServices<S>(
  functionName: string,
  commLinks: CommLink<S>[]
): void {
  const serviceNames = _.map(commLinks, c => c.name);

  _.each(commLinks, (commLink, n) => {
    const isLastService = n === commLinks.length - 1;
    const isFirstService = n === 0;
    const nextService = serviceNames[n + 1];
    const prevService = serviceNames[n - 1];
    const currService = commLink.name;

    if (isFirstService) {
      commLink.addHandler(
        `${currService}>push`, async (msg) => {
          if (msg.kind !== 'push') return;
          commLink.send(Address(msg.msg, { id: msg.id, to: currService }));
        },
      );
      commLink.addHandler(
        `${nextService}>yield`, async (msg) => {
          if (msg.kind !== 'yield') return;
          commLink.send(Address(Yielded(msg.value), { id: msg.id, to: currService }));
        },
      );
    }

    if (!isFirstService) {
      commLink.addHandler(
        `${nextService}>yield`, async (msg) => {
          if (msg.kind !== 'yield') return;
          commLink.send(Address(msg, { to: prevService }));
        },
      );
    }

    if (!isLastService) {
      commLink.addHandler(
        `${currService}>yield`, async (msg) => {
          if (msg.kind !== 'yield') return;
          commLink.send(Address(Dispatch(functionName, msg.value), { id: msg.id, to: nextService }));
        },
      );
    }
    if (isLastService) {
      commLink.addHandler(`${currService}>yield`, async (msg) => {
        if (msg.kind !== 'yield') return;
        commLink.send(Address(msg, { to: prevService }));
      });
    }

    commLink.addHandler(`dispatch/${functionName}`, async function(msg) {
      if (msg.kind !== 'dispatch') return;
      const { func, arg } = msg;
      const f = commLink.dispatchHandlers[func];
      if (f !== undefined) {
        const bf = _.bind(f, this);
        const result = await bf(arg);
        const yld = result === undefined ? null : result;

        await commLink.send(
          Address(
            Yield(yld), { id: msg.id, to: currService }
          )
        );
      }
    });
  });
}
