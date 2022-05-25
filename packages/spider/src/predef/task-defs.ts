import _ from 'lodash';

import { flow as fptsFlow, pipe } from 'fp-ts/function';

import { Logger } from 'winston';
import { Page } from 'puppeteer';


import { taskflow as ft } from '@watr/commonlib';
import { BrowserInstance, BrowserPool } from '~/browser-pool';
import { UrlFetchData } from '~/url-fetch-chains';


export interface ExtractionSharedEnv {
  log: Logger;
  browserPool: BrowserPool;
  urlFetchData?: UrlFetchData;
};

export interface ExtractionEnv extends ExtractionSharedEnv {
  ns: string[];
  entryPath: string;
  urlFetchData: UrlFetchData;
  fileContentCache: Record<string, any>;
  browserPageCache: Record<string, Page>;
  browserInstance: BrowserInstance;
  enterNS(ns: string[]): void;
  exitNS(ns: string[]): void;
};

const fp = ft.createFPackage<ExtractionEnv>();
