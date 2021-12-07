import _ from 'lodash';

import {
  HTTPResponse,
  HTTPRequest,
  PageEventObject,
  Page,
  ConsoleMessage,
  // Frame,
  Metrics,
  WebWorker,
  Dialog
} from 'puppeteer';
import { ScrapingContext } from './scraping-context';

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

export function logPageEvents(ctx: ScrapingContext, page: Page) {
  const { entryLogger } = ctx;

  const log = entryLogger;

  _.each(pageEvents, e => {
    page.on(e, (_data: any) => {
      switch (e) {
        case 'domcontentloaded':
        case 'load':
        case 'close': {
          log.debug({ pageEvent: e });
          break;
        }
        case 'console': {
          const data: ConsoleMessage = _data;
          const text = data.text();
          log.debug({ pageEvent: e, text });
          break;
        }
        case 'dialog': {
          const data: Dialog = _data;
          const message = data.message();
          log.debug({ pageEvent: e, message });
          break;
        }
        case 'pageerror':
        case 'error': {
          const data: Error = _data;
          const { message } = data;
          const { name } = data;
          log.debug({ pageEvent: e, name, message });
          break;
        }
        case 'frameattached':
        case 'framedetached':
        case 'framenavigated': {
          // const data: Frame = _data;
          log.debug({ pageEvent: e });
          break;
        }
        case 'metrics': {
          const data: { title: string, metrics: Metrics } = _data;
          log.debug({ pageEvent: e, data });
          break;
        }
        case 'popup': {
          // const data: Page = _data;
          log.debug({ pageEvent: e });
          break;
        }
        case 'request':
        case 'requestfailed':
        case 'requestfinished': {
          const data: HTTPRequest = _data;
          const url = data.url();
          log.debug({ pageEvent: e, url });
          break;
        }
        case 'response': {
          const data: HTTPResponse = _data;
          const url = data.url();
          log.debug({ pageEvent: e, url });
          break;
        }
        case 'workercreated':
        case 'workerdestroyed': {
          const data: WebWorker = _data;
          const url = data.url();
          log.debug({ pageEvent: e, url });
          break;
        }
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
