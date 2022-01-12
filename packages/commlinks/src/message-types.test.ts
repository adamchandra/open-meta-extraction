import _ from 'lodash';
import { Ack, Address, Dispatch, Message, Ping, Quit, Yield } from './message-types';
// import { prettyPrint } from '@watr/commonlib';

describe('Service Communication Hub lifecycle', () => {
  process.env['service-comm.loglevel'] = 'warn';

  it.only('should marshall/unmarshall messages', () => {
    const examples = [
      Yield({ someVal: '23' }),
      Dispatch('my-method', { arg: 0, arg2: '1' }),
      Ping,
      Ack(Ping),
      Quit
    ];

    _.each(examples, example => {
      const addressed = Address(example, { from: 'sender', to: 'recipient', id: 23 });
      const packedMsg = Message.pack(addressed);
      const unpackedMsg = Message.unpack(packedMsg);

      // prettyPrint({ packedMsg, unpackedMsg });
      expect(unpackedMsg).toStrictEqual(addressed);
    });
  });
});
