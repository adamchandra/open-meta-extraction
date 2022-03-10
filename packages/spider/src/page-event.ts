import _ from 'lodash';

import {
  HTTPResponse,
  HTTPRequest,
  PageEventObject,
  Page,
  ConsoleMessage,
  Metrics,
  WebWorker,
  Dialog,
  BrowserEmittedEvents,
} from 'puppeteer';

import { Logger } from 'winston';

import { BrowserInstance } from './browser-pool';

const pageEvents: Array<keyof PageEventObject> = [
  'close',
  'console',
  'dialog',
  'domcontentloaded',
  'error',
  'frameattached',
  'framedetached',
  'framenavigated',
  'load',
  'metrics',
  'pageerror',
  'popup',
  'request',
  'requestfailed',
  'requestfinished',
  'response',
  'workercreated',
  'workerdestroyed',
];


export function logBrowserEvent(browserInstance: BrowserInstance, logger: Logger) {
  const { browser } = browserInstance;

  const events = [
    BrowserEmittedEvents.TargetChanged,
    BrowserEmittedEvents.TargetCreated,
    BrowserEmittedEvents.TargetDestroyed,
    BrowserEmittedEvents.Disconnected,
  ]

  const bproc = browser.process();
  const pid = bproc?.pid;
  if (bproc === null || pid === undefined) {
    // prettyPrint({ bproc, pid })
    logger.error('logBrowserEvents(): browser.process().pid is undefined');
    return;
  }

  _.each(events, (event) => {
    browser.on(event, (e) => {
      const ttype = e?._targetInfo?.type;
      const turl = e?._targetInfo?.url;
      logger.verbose(`Browser#${pid}: browserEvent: ${event}, targetType: ${ttype}, targetUrl: ${turl}`);
    });
  });
}

export function logPageEvents(page: Page, logger: Logger) {

  const bproc = page.browser().process();
  const pid = bproc?.pid;
  if (bproc === null || pid === undefined) {
    logger.error('logPageEvents(): browser.process().pid is undefined');
    return;
  }

  _.each(pageEvents, e => {
    page.on(e, (_data: any) => {
      switch (e) {
        case 'domcontentloaded':
        case 'load':
        case 'close': {
          logger.verbose(`Browser#${pid}/pageEvent: ${e}`);
          break;
        }
        case 'console': {
          const data: ConsoleMessage = _data;
          const text = data.text();
          logger.verbose(`Browser#${pid}/pageEvent: ${e}: ${text}`);
          break;
        }
        case 'dialog': {
          const data: Dialog = _data;
          const message = data.message();
          logger.debug(`Browser#${pid}/pageEvent: ${e}: ${message}`);
          break;
        }
        case 'pageerror':
        case 'error': {
          const data: Error = _data;
          const { message } = data;
          const { name } = data;
          logger.debug(`Browser#${pid}/pageEvent: ${e}: ${name} / ${message}`);
          break;
        }
        case 'frameattached':
        case 'framedetached':
        case 'framenavigated': {
          // const data: Frame = _data;
          logger.verbose(`Browser#${pid}/pageEvent: ${e}`);
          break;
        }
        case 'metrics': {
          const data: { title: string, metrics: Metrics } = _data;
          logger.verbose(`Browser#${pid}/pageEvent: ${e}: ${data.title} / ${data.metrics}`);
          break;
        }
        case 'popup': {
          logger.debug(`Browser#${pid}/pageEvent: ${e}`);
          break;
        }
        case 'requestfailed': {
          const data: HTTPRequest = _data;
          const url = data.url();
          logger.debug(`Browser#${pid}/pageEvent: ${e}: ${url}`);
          break;
        }
        case 'request':
        case 'requestfinished': {
          const data: HTTPRequest = _data;
          const url = data.url();
          logger.verbose(`Browser#${pid}/pageEvent: ${e}: ${url}`);
          break;
        }
        case 'response': {
          const data: HTTPResponse = _data;
          const url = data.url();
          logger.verbose(`Browser#${pid}/pageEvent: ${e}: ${url}`);
          break;
        }
        case 'workercreated':
        case 'workerdestroyed': {
          const data: WebWorker = _data;
          const url = data.url();
          logger.verbose(`Browser#${pid}/pageEvent: ${e}: ${url}`);
          break;
        }
        default:
          logger.debug(`Browser#${pid}/Unknown event: ${e}`);
      }
    });
  });
}


/*

    page.$(selector)
    page.$$(selector)
    page.$$eval(selector, pageFunction[, ...args])
    page.$eval(selector, pageFunction[, ...args])
    page.$x(expression)
    page.accessibility
    page.addScriptTag(options)
    page.addStyleTag(options)
    page.authenticate(credentials)
    page.bringToFront()
    page.browser()
    page.browserContext()
    page.click(selector[, options])
    page.close([options])
    page.content()
    page.cookies([...urls])
    page.coverage
    page.deleteCookie(...cookies)
    page.emulate(options)
    page.emulateMediaFeatures(features)
    page.emulateMediaType(type)
    page.emulateTimezone(timezoneId)
    page.emulateVisionDeficiency(type)
    page.evaluate(pageFunction[, ...args])
    page.evaluateHandle(pageFunction[, ...args])
    page.evaluateOnNewDocument(pageFunction[, ...args])
    page.exposeFunction(name, puppeteerFunction)
    page.focus(selector)
    page.frames()
    page.goBack([options])
    page.goForward([options])
    page.goto(url[, options])
    page.hover(selector)
    page.isClosed()
    page.isJavaScriptEnabled()
    page.keyboard
    page.mainFrame()
    page.metrics()
    page.mouse
    page.pdf([options])
    page.queryObjects(prototypeHandle)
    page.reload([options])
    page.screenshot([options])
    page.select(selector, ...values)
    page.setBypassCSP(enabled)
    page.setCacheEnabled([enabled])
    page.setContent(html[, options])
    page.setCookie(...cookies)
    page.setDefaultNavigationTimeout(timeout)
    page.setDefaultTimeout(timeout)
    page.setExtraHTTPHeaders(headers)
    page.setGeolocation(options)
    page.setJavaScriptEnabled(enabled)
    page.setOfflineMode(enabled)
    page.setRequestInterception(value)
    page.setUserAgent(userAgent)
    page.setViewport(viewport)
    page.tap(selector)
    page.target()
    page.title()
    page.touchscreen
    page.tracing
    page.type(selector, text[, options])
    page.url()
    page.viewport()
    page.waitFor(selectorOrFunctionOrTimeout[, options[, ...args]])
    page.waitForFileChooser([options])
    page.waitForFunction(pageFunction[, options[, ...args]])
    page.waitForNavigation([options])
    page.waitForRequest(urlOrPredicate[, options])
    page.waitForResponse(urlOrPredicate[, options])
    page.waitForSelector(selector[, options])
    page.waitForXPath(xpath[, options])
    page.workers()
    GeolocationOptions
    WaitTimeoutOptions

  */
