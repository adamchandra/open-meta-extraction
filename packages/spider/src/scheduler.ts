import { Readable } from 'stream';

import {
  streamPump,
} from '@watr/commonlib';

type UrlString = string;

export interface CrawlScheduler {
  addUrls(urlStream: Readable): Promise<number>;
  startingUrls: UrlString[];
  getUrlStream(): Readable; // <string>;
}

export function initCrawlScheduler(): CrawlScheduler {
  const crawlScheduler: CrawlScheduler = {
    startingUrls: [],
    async addUrls(urlStream: Readable) {
      const inputUrls = await streamPump.createPump()
        .viaStream<string>(urlStream)
        .filter(() => {
          // TODO check if valid url
          return true;
        })
        .gather()
        .toPromise();

      const newUrls = inputUrls || [];
      this.startingUrls.push(...newUrls);
      return newUrls.length;
    },
    getUrlStream(): Readable { // <string>;
      return Readable.from(this.startingUrls);
    },
  };

  return crawlScheduler;
}
