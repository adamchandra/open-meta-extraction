import _ from 'lodash';

import {
  Browser as PBrowser,
} from 'puppeteer';

import puppeteer from 'puppeteer-extra';

// @ts-ignore
import AnonPlugin from 'puppeteer-extra-plugin-anonymize-ua';

// @ts-ignore
import blockResourcesPlugin from 'puppeteer-extra-plugin-block-resources';
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

let usingResourceBlockPlugin = false;

const AllBlockableResources = {
  stylesheet: null,
  image: null,
  document: null,
  media: null,
  font: null,
  script: null,
  texttrack: null,
  xhr: null,
  fetch: null,
  eventsource: null,
  websocket: null,
  manifest: null,
  other: null
};

type BlockableResources = typeof AllBlockableResources;
type BlockableResource = keyof BlockableResources;

const BlockableResources: BlockableResource[] = _.keys(AllBlockableResources) as BlockableResource[];

const blockResPlugin = blockResourcesPlugin({
  blockedTypes: new Set<BlockableResource>()
});

export function allowResourceTypes(rs: BlockableResource[]): void {
  BlockableResources.forEach(r => blockResPlugin.blockedTypes.add(r));
  rs.forEach(r => blockResPlugin.blockedTypes.delete(r))
}

export function blockResourceTypes(rs: BlockableResource[]): void {
  BlockableResources.forEach(r => blockResPlugin.blockedTypes.delete(r));
  rs.forEach(r => blockResPlugin.blockedTypes.add(r))
}

export function blockedResourceTypes(): BlockableResource[] {
  const bs: Set<BlockableResource> = blockResPlugin.blockedTypes;
  return [ ...bs ];
}

export function useResourceBlockPlugin(): void {
  if (usingResourceBlockPlugin) return;
  usingResourceBlockPlugin = true;
  puppeteer.use(blockResPlugin);

  allowResourceTypes(['document'])
}

export async function launchBrowser(): Promise<Browser> {
  useStealthPlugin();
  useAnonPlugin();
  useResourceBlockPlugin();
  return puppeteer.launch({
    headless: true,
    // These arguments seem to be required to avoid bug where chrome doesn't shutdown on browser.close()
    // args: ['--single-process', '--no-zygote', '--no-sandbox'],
    // executablePath: process.env.CHROME_EXECUTABLE,
    // devtools: true,
  });
}
