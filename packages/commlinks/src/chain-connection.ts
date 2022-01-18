import _ from 'lodash';

import { CommLink } from './commlink';

import {
  Message,
  call,
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
      // This just exists to allow calling first commLink with initial message
      // commLink.addHandler(
      //   `${currService}>push`, async (msg) => {
      //     if (msg.kind !== 'push') return;
      //     commLink.send(Message.address(msg.msg, { id: msg.id, to: currService }));
      //   },
      // );
      commLink.on({
        kind: 'reply',
        from: nextService
      }, async (msg: Message) => {
        if (msg.kind !== 'reply') return;
        // TODO commLink.send(Message.address(Yielded(msg.value), { id: msg.id, to: currService }));
      });

      // commLink.addHandler(
      //   `${nextService}>yield`, async (msg) => {
      //     if (msg.kind !== 'yield') return;
      //     commLink.send(Message.address(Yielded(msg.value), { id: msg.id, to: currService }));
      //   },
      // );
    }

    if (!isFirstService) {
      commLink.on({
        kind: 'reply',
        from: nextService
      }, async (msg: Message) => {
        if (msg.kind !== 'reply') return;
        commLink.send(Message.address(msg, { to: prevService }));
      });
      // commLink.addHandler(
      //   `${nextService}>yield`, async (msg) => {
      //     if (msg.kind !== 'yield') return;
      //     commLink.send(Message.address(msg, { to: prevService }));
      //   },
      // );
    }

    if (!isLastService) {
      commLink.on({
        kind: 'reply',
        from: currService
      }, async (msg: Message) => {
        if (msg.kind !== 'reply') return;
        commLink.send(Message.address(call(functionName, msg.value), { id: msg.id, to: nextService }));
      });
      // commLink.addHandler(
      //   `${currService}>yield`, async (msg) => {
      //     if (msg.kind !== 'yield') return;
      //     commLink.send(Message.address(Call(functionName, msg.value), { id: msg.id, to: nextService }));
      //   },
      // );
    }
    if (isLastService) {
      commLink.on({
        kind: 'reply',
        from: currService
      }, async (msg: Message) => {
        if (msg.kind !== 'reply') return;
        commLink.send(Message.address(msg, { to: prevService }));
      });
      // commLink.addHandler(`${currService}>yield`, async (msg) => {
      //   if (msg.kind !== 'yield') return;
      //   commLink.send(Message.address(msg, { to: prevService }));
      // });
    }

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
