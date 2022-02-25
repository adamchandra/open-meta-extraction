import { prettyPrint } from '@watr/commonlib';
import _ from 'lodash';
import { awaitQuit, initCommLinks } from '~/util/service-test-utils';
import { newCommLink } from './commlink';
import { ping, addHeaders, Message, cyield } from './message-types';

describe('CommLink Communication', () => {

  process.env['service-comm.loglevel'] = 'info';

  it('should compile', async (done) => {
    interface MyClient {
      func1(arg: any): void;
      func2(arg: any): void;
    }
    const Client: MyClient = {
      func1(arg: any): void {
        const thisType = typeof this;
        prettyPrint({ msg: 'called func1', arg, thisType });
        return { ...arg, msg: 'func1' };
      },
      func2(arg: any): void {
        prettyPrint({ msg: 'called func2', arg });
        return { ...arg, msg: 'func2' };
      }
    };

    const commLink = newCommLink<MyClient>('MyClient', Client);

    // comm1.on()
      // // don't compile!!
    // const ret0 = await comm0.call('no-func1', { foo: 'bar' });
    const ret0 = await commLink.call('func1', { foo: 'bar' });
    prettyPrint({ ret0 });

    // await awaitQuit([commLink])
    done();
  });


  it('should startup/quit', async () => {
    const commLink0 = newCommLink<undefined>('commlink0', undefined);
    await commLink0.connect();

    // TODO rename yield/yielded to relay/return
    await commLink0.quit();
  });

  it('should ping/ack', async (done) => {
    const commLinks = await initCommLinks(2, () => undefined)

    const [comm0, comm1] = commLinks;
    const ping0 = addHeaders(ping, { to: comm1.name, from: comm0.name, id: 0 });
    await comm0.send(ping0);

    comm0.on({ kind: 'ack' }, async (msg: Message) => {
      prettyPrint({ info: 'comm0 received msg', msg });
      await awaitQuit(commLinks)
      done();
    });
  });


  it('should call local client methods, with events generated for call/yield/return', async (done) => {
    const Client = {
      func1(arg: any): void {
        const thisType = typeof this;
        prettyPrint({ msg: 'called func1', arg, thisType });
        return { ...arg, msg: 'func1' };
      },
      func2(arg: any): void {
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

    await awaitQuit(commLinks)
    done();
  });

  it('should call remote client methods, with events generated for call/yield/return', async (done) => {
    const Client = {
      func1(arg: any): void {
        const thisType = typeof this;
        prettyPrint({ msg: 'called func1', arg, thisType });
        return { ...arg, msg: 'func1' };
      },
      func2(arg: any): void {
        prettyPrint({ msg: 'called func2', arg });
        return { ...arg, msg: 'func2' };
      }
    };
    const commLinks = await initCommLinks(2, () => Client)

    const [comm0, comm1] = commLinks;
    const ret1 = await comm0.call('func1', { foo: 'bar' }, { to: comm1.name });

    prettyPrint({ ret1 })

    await awaitQuit(commLinks)
    done();
  });

  it('should allow intercept/modification of yielded values', async (done) => {
    const Client = {
      func1(arg: any): void {
        const thisType = typeof this;
        prettyPrint({ msg: 'called func1', arg, thisType });
        return { ...arg, msg: 'func1' };
      },
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
    done();
  });

});
