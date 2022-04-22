import { prettyPrint, setLogEnvLevel } from '@watr/commonlib';
import _ from 'lodash';
import { awaitQuit, initCommLinks } from '~/util/service-test-utils';
import { CustomHandlers } from '..';
import { newCommLink } from './commlink';
import { ping, addHeaders, Message, cyield } from './message-types';

describe('CommLink Communication', () => {
  setLogEnvLevel('info');

  interface MyClient extends CustomHandlers<unknown> {
    func1(arg: any): Promise<void>;
    func2(arg: any): Promise<void>;
  }

  it('should compile', async () => {

    const Client: MyClient = {
      func1(arg: any): Promise<void> {
        const thisType = typeof this;
        prettyPrint({ msg: 'called func1', arg, thisType });
        return { ...arg, msg: 'func1' };
      },

      func2(arg: any): Promise<void> {
        prettyPrint({ msg: 'called func2', arg });
        return { ...arg, msg: 'func2' };
      },

      async func3(arg: any): Promise<void> {
        prettyPrint({ msg: 'called func2', arg });
        return;
      }
    };

    const commLink = newCommLink<MyClient>('MyClient').withMethods(Client);
    await commLink.connect();

    // comm1.on()
    // // don't compile!!
    // const ret0 = await comm0.call('no-func1', { foo: 'bar' });

    const ret0 = await commLink.call('func1', { foo: 'bar' });

    prettyPrint({ ret0 });

    await awaitQuit([commLink])
  });


  const emptyHandlers: CustomHandlers<unknown> = {};

  it('should startup/quit', async () => {
    const commLink0 = newCommLink<typeof emptyHandlers>('commlink0').withMethods(emptyHandlers);
    await commLink0.connect();

    // TODO rename yield/yielded to relay/return
    await commLink0.quit();
  });

  it('should ping/ack', async () => {
    const commLinks = await initCommLinks<typeof emptyHandlers>(2, () => emptyHandlers)

    const [comm0, comm1] = commLinks;
    const ping0 = addHeaders(ping, { to: comm1.name, from: comm0.name, id: 0 });
    await comm0.send(ping0);

    return new Promise((resolve) => {
      comm0.on({ kind: 'ack' }, async (msg: Message) => {
        prettyPrint({ info: 'comm0 received msg', msg });
        await awaitQuit(commLinks)
        return resolve(undefined);
      });
    });
  });


  it('should call local client methods, with events generated for call/yield/return', async () => {
    const Client: MyClient = {
      func1(arg: any): Promise<void> {
        const thisType = typeof this;
        prettyPrint({ msg: 'called func1', arg, thisType });
        return { ...arg, msg: 'func1' };
      },
      func2(arg: any): Promise<void> {
        prettyPrint({ msg: 'called func2', arg });
        return { ...arg, msg: 'func2' };
      }
    };
    const commLinks = await initCommLinks<typeof Client>(2, () => Client)

    const [comm0, comm1] = commLinks;
    // comm1.on()
    // // don't compile!!
    // const ret0 = await comm0.call('no-func1', { foo: 'bar' });
    const ret0 = await comm0.call('func1', { foo: 'bar' });
    prettyPrint({ ret0 });

    return awaitQuit(commLinks)
  });

  it('should call remote client methods, with events generated for call/yield/return', async () => {
    const Client: MyClient = {
      func1(arg: any): Promise<void> {
        const thisType = typeof this;
        prettyPrint({ msg: 'called func1', arg, thisType });
        return { ...arg, msg: 'func1' };
      },
      func2(arg: any): Promise<void> {
        prettyPrint({ msg: 'called func2', arg });
        return { ...arg, msg: 'func2' };
      }
    };
    const commLinks = await initCommLinks(2, () => Client)

    const [comm0, comm1] = commLinks;
    const ret1 = await comm0.call('func1', { foo: 'bar' }, { to: comm1.name });

    prettyPrint({ ret1 })

    await awaitQuit(commLinks)
  });

  it('should allow intercept/modification of yielded values', async () => {
    const Client: MyClient = {
      func1(arg: any): Promise<void> {
        const thisType = typeof this;
        prettyPrint({ msg: 'called func1', arg, thisType });
        return { ...arg, msg: 'func1' };
      },
      async func2(arg: any): Promise<void> {
        return;
      }
    };
    const commLinks = await initCommLinks(2, () => Client)

    const [comm0, comm1] = commLinks;

    comm1.on(cyield('func1'), async (msg: Message) => {
      if (msg.kind !== 'cyield') return;
      return {
        ...msg,
        result: {
          orig: msg.result,
          added: 'field'
        }
      };
    });
    const ret1 = await comm0.call('func1', { foo: 'bar' }, { to: comm1.name });

    prettyPrint({ ret1 })

    await awaitQuit(commLinks)
  });

});
