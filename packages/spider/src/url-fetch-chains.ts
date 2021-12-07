import _ from 'lodash';

import {
  HTTPRequest, HTTPResponse,
} from 'puppeteer';

import { AlphaRecord } from '@watr/commonlib';

export interface UrlChainLink {
  requestUrl: string;
  responseUrl?: string;
  status: string;
  timestamp: string;
}

export type UrlChain = UrlChainLink[];

export interface UrlFetchData extends UrlChainLink {
  responseUrl: string;
  fetchChain: UrlChain;
}

export function getUrlChainFromRequest(request: HTTPRequest): UrlChain {
  const reqRedirectChain = request.redirectChain();
  const urlChain = _.flatMap(reqRedirectChain, req => {
    const requestUrl = req.url();
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


export function getFetchDataFromResponse(requestUrl: string, response: HTTPResponse): UrlFetchData {
  const request: HTTPRequest = response.request();
  const fetchChain = getUrlChainFromRequest(request);

  const responseUrl = response.url();
  const status = response.status().toString();
  const { date } = response.headers();

  const metadata: UrlFetchData = {
    requestUrl,
    responseUrl,
    status,
    fetchChain,
    timestamp: date,
  };
  return metadata;
}


// Testing functions
export function mockUrl(n: number): string {
  return `http://doi.org/${n}`;
}

export function mockUrlFetchData(n: number): UrlFetchData {
  const fetchChain: UrlChainLink[] = _.map(_.range(n), (n) => {
    const link: UrlChainLink = {
      requestUrl: mockUrl(n),
      responseUrl: mockUrl(n + 1),
      status: '303',
      timestamp: '',
    };
    return link;
  });

  const metadata: UrlFetchData = {
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
