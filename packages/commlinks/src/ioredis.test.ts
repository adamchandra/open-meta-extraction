import _ from 'lodash';
import Redis from 'ioredis';
import { putStrLn } from '@watr/commonlib';

describe('IORedis library tests and examples', () => {
  it('should do async set/get', async () => {
    const rclient = new Redis();
    await rclient.set('mykey', 'my-value')
      .catch((error) => {
        console.log('Error', error);
      });

    const value = await rclient.get('mykey')
      .catch((error) => {
        console.log('Error', error);
      });

    expect(value).toEqual('my-value');

    return rclient.quit();
  });

  it('should do pub/sub', async (done) => {
    const rclient = new Redis();
    const subClient = new Redis();

    await subClient.subscribe('topic.foo');
    await subClient.subscribe('exit');

    subClient.on('message', (channel, message) => {
      if (channel === 'exit') {
        expect(message).toEqual('quit');
      }
      if (channel === 'topic.foo') {
        expect(message).toEqual('foo.msg');
      }
      if (channel === 'exit' && message === 'quit') {
        rclient.quit()
          .then(() => subClient.quit())
          .then(() => done());
      }
    });

    await rclient.publish('topic.foo', 'foo.msg');
    rclient.publish('exit', 'quit');
  });

  // ('pass function arguments', async (done) => {

  //   const exitClient = new Redis();
  //   const rclient = new Redis();
  //   const subClient = new Redis();

  //   try {
  //     exitClient.on('message', (channel) => {
  //       if (channel === 'exit') {
  //         rclient.quit()
  //           .then(() => subClient.quit())
  //           .then(() => exitClient.quit())
  //           .then(() => done());
  //       }
  //     });

  //     await rclient.del('mylist');


  //     await rclient.brpop('mylist', 0)
  //       .then((rval) => {
  //         putStrLn(`rval ${rval}`);
  //       });

  //     putStrLn('awaiting pop.. ');

  //     await subClient.rpush('mylist', '{ arg: 0 }');

  //   } catch (error) {
  //     putStrLn(`Error: ${error}`);
  //   }


  //   // rclient.brpop
  //   // rclient.brpoplpush
  //   // rclient.blpop

  //   rclient.publish('exit', 'quit');

  // });
});
