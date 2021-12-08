
import { createBrowserPool } from './browser-pool';

describe('browser pooling', () => {
  it('borrow/return to pool', async () => {
    const browserPool = createBrowserPool();
    const browser = await browserPool.acquire();
    await browserPool.release(browser);


    await browserPool.shutdown();
  });

  it('shutdown on error', async () => {
    console.log('pos.0');
    const browserPool = createBrowserPool();

    console.log('pos.1');

    await browserPool.use(async browser => {
      console.log('pos.2');
      throw new Error('problem');
    }).catch((err) => {
      console.log('pos.4');
      console.log('but we are okay now...');
    });

    const browser = await browserPool.acquire();
    await browserPool.release(browser);

    await browserPool.shutdown();

    console.log('pos.7');
  });
});
