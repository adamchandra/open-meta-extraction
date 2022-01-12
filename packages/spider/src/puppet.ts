import {
  Browser as PBrowser,
} from 'puppeteer';

import puppeteer from 'puppeteer-extra';

// @ts-ignore
import AnonPlugin from 'puppeteer-extra-plugin-anonymize-ua';
// @ts-ignore
import blockResources from 'puppeteer-extra-plugin-block-resources';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

export type Browser = PBrowser;
export const Browser = PBrowser;

export function useStealthPlugin(): void {
  puppeteer.use(StealthPlugin());
}

export function useAnonPlugin(): void {
  puppeteer.use(AnonPlugin());
}

export function useResourceBlockPlugin(): void {
  // const allResourceTypes = ['document', 'stylesheet', 'image', 'media', 'font', 'script', 'texttrack', 'xhr', 'fetch', 'eventsource', 'websocket', 'manifest', 'other'];
  const blockedResourceTypes = [
    'stylesheet',
    'image',
    // 'document',
    // 'media',
    'font',
    'script',
    // 'texttrack',
    'xhr',
    // 'fetch',
    // 'eventsource',
    // 'websocket',
    // 'manifest',
    // 'other'
  ];


  puppeteer.use(blockResources({
    blockedTypes: new Set(blockedResourceTypes)
  }));
}

export async function launchBrowser(): Promise<Browser> {
  return puppeteer.launch({
    headless: true,
    // These arguments seem to be required to avoid bug where chrome doesn't shutdown on browser.close()
    args: ['--single-process', '--no-zygote', '--no-sandbox'],
    executablePath: process.env.CHROME_EXECUTABLE,
    // devtools: true,
  });
}
