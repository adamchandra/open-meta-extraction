import { prettyPrint } from '@watr/commonlib';
import _ from 'lodash';
import { newCommLink2X } from '.';
import { newCommLink } from './commlink';
import { ping, addHeaders, Message } from './message-types';

describe('CommLink Communication', () => {
  process.env['service-comm.loglevel'] = 'silly';

  it('should startup/quit', async () => {
    const commLink0 = newCommLink<undefined>('commlink0');
    await commLink0.connect(undefined);

    // TODO rename yield/yielded to relay/return
    await commLink0.quit();
  });

  it('should ping/ack', async (done) => {
    const commNames = _.map(_.range(2), (i) => `commLink-${i}`);
    const commLinks = _.map(commNames, (name) => newCommLink<undefined>(name));
    await Promise.all(_.map(commLinks, (commLink) => commLink.connect(undefined)));

    const [comm0, comm1] = commLinks;
    const ping0 = addHeaders(ping, { to: comm1.name, from: comm0.name, id: 0 })
    await comm0.send(ping0)

    comm0.on({ kind: 'ack' }, async (msg: Message) => {
      prettyPrint({ info: 'comm0 received msg', msg })
      await Promise.all(_.map(commLinks, (commLink) => commLink.quit()));
      done();
    });
  });


  it.only('should call client methods', async (done) => {
    const Client = {
      func1(arg: any): void {
        const thisType = typeof this;
        prettyPrint({ msg: 'called func1', arg, thisThing: this });
      },
      func2(arg: any): void {
        prettyPrint({ msg: 'called func2', arg });
      }
    }
    const commNames = _.map(_.range(2), (i) => `commLink-${i}`);
    const commLinks = _.map(commNames, (name) => newCommLink2X(name, Client));
    await Promise.all(_.map(commLinks, (commLink) => commLink.connect()));

    const [comm0, comm1] = commLinks;
    await comm0.call('func1', { foo: 'bar' })
    await comm0.call('func0', { baz: 'quux' })

    await Promise.all(_.map(commLinks, (commLink) => commLink.quit()));
    done();
  });
});
