import { AlphaRecord } from '@watr/commonlib';
import _ from 'lodash';

import {
  HTTPRequest, HTTPResponse,
} from 'puppeteer';

import { UrlChain, UrlChainLink } from './url-fetch-chains';

export function createRequestChain(request: HTTPRequest): UrlChain {
  const reqRedirectChain = request.redirectChain();
  const urlChain = _.flatMap(reqRedirectChain, req => {
    const requestUrl = req.url();
    // const timestamp = makeTimestamp();
    const resp = req.response();

    if (resp === null) {
      return [];
    }

    const responseChainHeaders = resp.headers();
    const status = resp.status().toString();


    const { location, date } = responseChainHeaders;

    const chainLink: UrlChainLink = {
      requestUrl,
      responseUrl: location,
      status,
      timestamp: date
    };
    return [chainLink];
  });
  return urlChain;
}

export interface Metadata extends UrlChainLink {
  responseUrl: string;
  fetchChain: UrlChain;
}

export function createMetadata(requestUrl: string, response: HTTPResponse): Metadata {
  const request: HTTPRequest = response.request();
  const fetchChain = createRequestChain(request);

  const responseUrl = response.url();
  const status = response.status().toString();
  // const method = request.method();
  const { date } = response.headers();

  const metadata: Metadata = {
    requestUrl,
    responseUrl,
    status,
    fetchChain,
    // method,
    timestamp: date,
  };
  return metadata;
}


// Testing functions
export function mockUrl(n: number): string {
  return `http://doi.org/${n}`;
}

export function mockMetadata(n: number): Metadata {
  const fetchChain: UrlChainLink[] = _.map(_.range(n), (n) => {
    const link: UrlChainLink = {
      requestUrl: mockUrl(n),
      responseUrl: mockUrl(n + 1),
      status: '303',
      timestamp: '',
    };
    return link;
  });

  const metadata: Metadata = {
    requestUrl: mockUrl(0),
    responseUrl: mockUrl(n),
    status: '200',
    fetchChain,
    timestamp: ''
  };

  return metadata;
}


export function mockAlphaRecord(n: number): AlphaRecord {
  return ({
    noteId: `note-id-${n}`,
    dblpConfId: `dblp/conf/conf-${n}`, // TODO rename to dblpKey
    title: `The Title Paper #${n}`,
    authorId: `auth-${n}`,
    url: mockUrl(n)
  });
}
