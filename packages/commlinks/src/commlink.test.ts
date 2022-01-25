import { prettyPrint } from '@watr/commonlib';
import _ from 'lodash';
import { cyield } from '.';
import { newCommLink } from './commlink';
import { ping, addHeaders, Message } from './message-types';

describe('CommLink Communication', () => {
  process.env['service-comm.loglevel'] = 'silly';

  it('should startup/quit', async () => {
    const commLink0 = newCommLink<undefined>('commlink0', undefined);
    await commLink0.connect();

    // TODO rename yield/yielded to relay/return
    await commLink0.quit();
  });

  it('should ping/ack', async (done) => {
    const commNames = _.map(_.range(2), (i) => `commLink-${i}`);
    const commLinks = _.map(commNames, (name) => newCommLink<undefined>(name));
    await Promise.all(_.map(commLinks, (commLink) => commLink.connect()));

    const [comm0, comm1] = commLinks;
    const ping0 = addHeaders(ping, { to: comm1.name, from: comm0.name, id: 0 });
    await comm0.send(ping0);

    comm0.on({ kind: 'ack' }, async (msg: Message) => {
      prettyPrint({ info: 'comm0 received msg', msg });
      await Promise.all(_.map(commLinks, (commLink) => commLink.quit()));
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
    const commNames = _.map(_.range(2), (i) => `commLink-${i}`);
    const commLinks = _.map(commNames, (name) => newCommLink(name, Client));
    await Promise.all(_.map(commLinks, (commLink) => commLink.connect()));

    const [comm0, comm1] = commLinks;
    // comm1.on()
    const ret0 = await comm0.call('func1', { foo: 'bar' });
    prettyPrint({ ret0 });

    await Promise.all(_.map(commLinks, (commLink) => commLink.quit()));
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
    const commNames = _.map(_.range(2), (i) => `commLink-${i}`);
    const commLinks = _.map(commNames, (name) => newCommLink(name, Client));
    await Promise.all(_.map(commLinks, (commLink) => commLink.connect()));

    const [comm0, comm1] = commLinks;
    const ret1 = await comm0.call('func1', { foo: 'bar' }, { to: commNames[1] });

    prettyPrint({ ret1 })

    await Promise.all(_.map(commLinks, (commLink) => commLink.quit()));
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
    const commNames = _.map(_.range(2), (i) => `commLink-${i}`);
    const commLinks = _.map(commNames, (name) => newCommLink(name, Client));
    await Promise.all(_.map(commLinks, (commLink) => commLink.connect()));

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
    const ret1 = await comm0.call('func1', { foo: 'bar' }, { to: commNames[1] });

    prettyPrint({ ret1 })

    await Promise.all(_.map(commLinks, (commLink) => commLink.quit()));
    done();
  });
});
