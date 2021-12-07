import _ from 'lodash';

export interface UrlChainLink {
  requestUrl: string;
  responseUrl?: string;
  status: string;
  timestamp: string;
}

export type UrlChain = UrlChainLink[];
export type UrlChains = UrlChain[];
