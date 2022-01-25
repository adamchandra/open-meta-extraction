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
