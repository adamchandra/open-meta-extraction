import _ from 'lodash';

import {
  Browser as PBrowser,
} from 'puppeteer';

import puppeteer from 'puppeteer-extra';

// @ts-ignore
import AnonPlugin from 'puppeteer-extra-plugin-anonymize-ua';

import StealthPlugin from 'puppeteer-extra-plugin-stealth';

export type Browser = PBrowser;
export const Browser = PBrowser;

let usingStealthPlugin = false;
export function useStealthPlugin(): void {
  if (usingStealthPlugin) return;
  usingStealthPlugin = true;

  puppeteer.use(StealthPlugin());
}

let usingAnonPlugin = false;
export function useAnonPlugin(): void {
  if (usingAnonPlugin) return;
  usingAnonPlugin = true;

  puppeteer.use(AnonPlugin());
}

export async function launchBrowser(): Promise<Browser> {
  useStealthPlugin();
  useAnonPlugin();
  return puppeteer.launch({
    headless: true,
    // These arguments seem to be required to avoid bug where chrome doesn't shutdown on browser.close()
    // args: ['--single-process', '--no-zygote', '--no-sandbox'],
    // executablePath: process.env.CHROME_EXECUTABLE,
    // devtools: true,
  });
}