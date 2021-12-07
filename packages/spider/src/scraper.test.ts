import _ from 'lodash';
import { initScraper } from './scraper';

describe('scraper tests', () => {

  it('should setup/teardown browser w/o resources leaking', async () => {
      const scraper = await initScraper();

      let isConnected = scraper.browser.isConnected();

      expect(isConnected).toBe(true);
      await scraper.quit();

      isConnected = scraper.browser.isConnected();
      expect(isConnected).toBe(false);
  });
});
