import _ from 'lodash';
import { fromHeader, queryAll } from '.';

import { CommLink } from './commlink';

import {
  Message,
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
      // This is no longer needed as the default behavior is to return a promise to result from call()
      // commLink.addHandler(
      //   `${nextService}>yield`, async (msg) => {
      //     if (msg.kind !== 'yield') return;
      //     commLink.send(Message.address(Yielded(msg.value), { id: msg.id, to: currService }));
      //   },
      // );
    }

    // if (!isFirstService) {
    //   commLink.on({
    //     kind: 'creturn',
    //     func: functionName,
    //     from: nextService
    //   }, async (msg: Message) => {
    //     if (msg.kind !== 'creturn') return;
    //     commLink.send(Message.address(msg, { to: prevService }));
    //   });
    // }

    if (!isLastService) {
      commLink.on({
        kind: 'cyield',
        func: functionName,
      }, async (msg: Message) => {
        if (msg.kind !== 'cyield') return;
        const r = await commLink.call(functionName, msg.value, { to: nextService });
        return { ...msg, value: r };
      });
    }
    // if (isLastService) {
    //   // TODO this should work without any extra message handling (if yield/return does the right thing)
    //   commLink.on({
    //     kind: 'cyield',
    //     func: functionName,
    //   }, async (msg: Message) => {
    //     if (msg.kind !== 'cyield') return;
    //     commLink.send(Message.address(msg, { to: prevService }));
    //   });
    // }

    // commLink.on({
    //   kind: 'cyield',
    //   func: functionName,
    //   from: currService
    // }, async (msg: Message) => {
    //   if (msg.kind !== 'cyield') return;
    //   const callMessge = Message.address(
    //     call(functionName, msg.value), { id: msg.id, to: currService }
    //   );
    //   await commLink.send(callMessge);
    // });
    // commLink.on(CallKind(functionName))
    // commLink.addHandler(`dispatch/${functionName}`, async function(msg) {
    //   if (msg.kind !== 'dispatch') return;
    //   const { func, arg } = msg;
    //   const f = commLink.dispatchHandlers[func];
    //   if (f !== undefined) {
    //     const bf = _.bind(f, this);
    //     const result = await bf(arg);
    //     const yld = result === undefined ? null : result;

    //     await commLink.send(
    //       Message.address(
    //         Yield(yld), { id: msg.id, to: currService }
    //       )
    //     );
    //   }
    // });
  });
}
