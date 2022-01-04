import _ from 'lodash';

import { ServiceComm } from './service-comm';

import {
  Address,
  Dispatch,
  Yield,
  Yielded
} from './service-defs';

export function chainServices<S>(
  functionName: string,
  serviceComms: ServiceComm<S>[]
): void {
  const serviceNames = _.map(serviceComms, c => c.name);

  _.each(serviceComms, (commLink, n) => {
    const isLastService = n === serviceComms.length - 1;
    const isFirstService = n === 0;
    const nextService = serviceNames[n + 1]
    const prevService = serviceNames[n - 1]
    const currService = commLink.name;

    if (isFirstService) {
      commLink.addHandler(
        `${currService}>push`, async function(msg) {
          if (msg.kind !== 'push') return;
          commLink.send(Address(msg.msg, { id: msg.id, to: currService }));
        },
      );
      commLink.addHandler(
        `${nextService}>yield`, async function(msg) {
          if (msg.kind !== 'yield') return;
          commLink.send(Address(Yielded(msg.value), { id: msg.id, to: currService }));
        },
      );
    }

    if (!isFirstService) {
      commLink.addHandler(
        `${nextService}>yield`, async function(msg) {
          if (msg.kind !== 'yield') return;
          commLink.send(Address(msg, { to: prevService }));
        },
      );
    }

    if (!isLastService) {
      commLink.addHandler(
        `${currService}>yield`, async function(msg) {
          if (msg.kind !== 'yield') return;
          commLink.send(Address(Dispatch(functionName, msg.value), { id: msg.id, to: nextService }));
        },
      );
    }
    if (isLastService) {
      commLink.addHandler(`${currService}>yield`, async function(msg) {
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
