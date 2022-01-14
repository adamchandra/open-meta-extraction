import _ from 'lodash';

import {
  Ack,
  Call,
  Message,
  MessageQuery,
  Ping,
  Quit,
  Yield,
  matchMessageToQuery,
  addHeaders,
  YieldKind
} from './message-types';

import { prettyPrint } from '@watr/commonlib';

describe('Service Communication Hub lifecycle', () => {
  process.env['service-comm.loglevel'] = 'warn';

  it('should marshall/unmarshall messages', () => {
    const examples = [
      Yield('myfunc', { someVal: '23' }),
      Call('my-method', { arg: 0, arg2: '1' }),
      Ping,
      Ack(Ping),
      Quit
    ];

    _.each(examples, example => {
      const addressed = Message.address(example, { from: 'sender', to: 'recipient', id: 23 });
      const packedMsg = Message.pack(addressed);
      const unpackedMsg = Message.unpack(packedMsg);

      prettyPrint({ packedMsg, unpackedMsg });
      // expect(unpackedMsg).toStrictEqual(addressed);
    });
  });

  it('should match messagekinds to messages for filtering', async (done) => {
    const queries: MessageQuery[] = [
      YieldKind('myfunc'), { id: 0 },
      addHeaders(YieldKind('myfunc'), { id: 0 }),
      addHeaders(YieldKind('myfunc'), { id: 1 }),
      addHeaders(YieldKind('myfunc'), { from: 'me' }),
      YieldKind('yourfunc'),
      // Message.address(YieldKind('myfunc'), { id: 0 }),
      // Call('my-method', { arg: 0, arg2: '1' }),
      // Ping,
      // Ack(Ping),
    ];
    const messageKinds: Message[] = [
      Message.address(Yield('myfunc', { foo: 'bar' }), { from: 'me', to: 'you' }),
    ];
    _.each(queries, (query) => {
      _.each(messageKinds, (mkind) => {

        const isMatch = matchMessageToQuery(query, mkind);
        prettyPrint({ isMatch, query, mkind });
      });
    });
    done();
  });
});
