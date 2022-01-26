import _ from 'lodash';
import Redis from 'ioredis';

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

});