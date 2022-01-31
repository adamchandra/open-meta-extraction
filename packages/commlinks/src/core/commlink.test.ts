import { prettyPrint } from '@watr/commonlib';
import _ from 'lodash';
import { CommLink } from '..';
import { newCommLink } from './commlink';
import { ping, addHeaders, Message, cyield } from './message-types';

describe('CommLink Communication', () => {
  async function initCommLinks<ClientT>(n: number, clientN: (i: number) => ClientT): Promise<CommLink<ClientT>[]> {
    const commNames = _.map(_.range(2), (i) => `commLink-${i}`);
    const commLinks = _.map(commNames, (name, i) => newCommLink(name, clientN(i)));
    return await Promise.all(_.map(commLinks, (commLink) => {
      return commLink.connect().then(() => commLink);
    }));
  }
  async function awaitQuit<A>(commLinks: CommLink<A>[]): Promise<void> {
    await Promise.all(_.map(commLinks, (commLink) => commLink.quit()));
  }

  process.env['service-comm.loglevel'] = 'silly';

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
    const commLinks = await initCommLinks(2, () => Client)

    const [comm0, comm1] = commLinks;
    // comm1.on()
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
        value: {
          ...msg.value,
          added: 'field'
        }
      };
    });
    const ret1 = await comm0.call('func1', { foo: 'bar' }, { to: comm1.name });

    prettyPrint({ ret1 })

    await awaitQuit(commLinks)
    done();
  });

  interface CallChain {
    chainFunction: string;
    orderedServices: string[];
  }

  it.only('should allow remote call pattern setup', async (done) => {
    const Client = {
      initCallChaining(arg: CallChain): void {
        const { name } = this;
        const { chainFunction, orderedServices } = arg;
        const i = orderedServices.indexOf(name);
        const serviceNotFound = i < 0;
        const isLastService = i === orderedServices.length - 1;
        const nextService = orderedServices[i + 1];
        if (serviceNotFound) {
          return;
        }
        if (isLastService) {
          return;
        }
        this.commLink.on(cyield(chainFunction), async (msg: Message) => {
          if (msg.kind !== 'cyield') return;
          const r = await this.commLink.call(chainFunction, msg.value, { to: nextService });
          return { ...msg, value: r };
        });

      },
    };
    const commLinks = await initCommLinks(2, () => Client)

    const [comm0, comm1] = commLinks;

    comm1.on(cyield('func1'), async (msg: Message) => {
      if (msg.kind !== 'cyield') return;
      return {
        ...msg,
        value: {
          ...msg.value,
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
