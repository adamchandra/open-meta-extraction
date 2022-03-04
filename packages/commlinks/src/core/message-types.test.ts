import _ from 'lodash';

import {
  Message,
  MessageQuery,
  quit,
  creturn,
  matchMessageToQuery,
  addHeaders,
  ping,
  ack,
  mreturn
} from './message-types';

import { prettyPrint } from '@watr/commonlib';
import { preflightCheck } from '..';

describe('Service Communication Hub lifecycle', () => {
  process.env['service-comm.loglevel'] = 'warn';

  it('should marshall/unmarshall messages', () => {
    const examples = [
      // Yield('myfunc', { someVal: '23' }),
      // Call('my-method', { arg: 0, arg2: '1' }),
      ping,
      ack(ping),
      quit
    ];

    _.each(examples, example => {
      const addressed = Message.address(example, { from: 'sender', to: 'recipient', id: 23 });
      const packedMsg = Message.pack(addressed);
      const unpackedMsg = Message.unpack(packedMsg);

      prettyPrint({ packedMsg, unpackedMsg });
      // expect(unpackedMsg).toStrictEqual(addressed);
    });
  });

  it('should match messagekinds to messages for filtering', (done) => {
    const queries: MessageQuery[] = [
      creturn('myfunc'), { id: 0 },
      addHeaders(creturn('myfunc'), { id: 0 }),
      addHeaders(creturn('myfunc'), { id: 1 }),
      addHeaders(creturn('myfunc'), { from: 'me' }),
      creturn('yourfunc'),
      // Message.address(YieldKind('myfunc'), { id: 0 }),
      // Call('my-method', { arg: 0, arg2: '1' }),
      // Ping,
      // Ack(Ping),
    ];
    const messageKinds: Message[] = [
      Message.address(mreturn('myfunc', { foo: 'bar' }), { from: 'me', to: 'you' }),
    ];
    _.each(queries, (query) => {
      prettyPrint({ msg: 'trying', query });
      _.each(messageKinds, (mkind) => {
        const isMatch = matchMessageToQuery(query, mkind);
        prettyPrint({ isMatch, mkind });
      });
    });
    done();
  });
});
