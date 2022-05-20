import _ from 'lodash';

import { UrlFetchData, BrowserPool, BrowserInstance } from '@watr/spider';
import { Logger } from 'winston';
import { Page } from 'puppeteer';
import * as ft from './function-defs';

import { ExtractionEvidence, Field } from './extraction-records';
import { ExtractionTask } from './function-defs';

interface NormalForms {
  'css-norm': null;
  'original': null;
  'tidy-norm': null
}

export type NormalForm = keyof NormalForms;

export interface FieldCandidate {
  text: string;
  evidence: string[];
}

export interface ExtractionSharedEnv {
  log: Logger;
  browserPool: BrowserPool;
  urlFetchData?: UrlFetchData;
};


export interface ExtractionEnv extends ExtractionSharedEnv {
  ns: string[];
  entryPath: string;
  urlFetchData: UrlFetchData;
  fieldRecs: Record<string, Field[]>;
  fields: Field[];
  evidence: ExtractionEvidence[];
  fieldCandidates: FieldCandidate[];
  fileContentCache: Record<string, any>;
  browserPageCache: Record<string, Page>;
  browserInstance: BrowserInstance;
  enterNS(ns: string[]): void;
  exitNS(ns: string[]): void;
};

const fp = ft.createFPackage<ExtractionEnv>();

export const {
  tap,
  tapLeft,
  through,
  log,
  filter,
  ClientFunc,
  Transform,
  forEachDo,
  attemptEach,
  takeWhileSuccess,
  gatherSuccess,
} = fp;

export type ControlInstruction = ft.ControlInstruction;

type EnvT = ExtractionEnv;

export type PerhapsW<A> = ft.PerhapsW<A, EnvT>;
export type ClientFunc<A, B> = ft.ClientFunc<A, B, EnvT>;
export type ClientResult<A> = ft.ClientResult<A>;
export type Transform<A, B> = ft.Transform<A, B, EnvT>;
export type FilterTransform<A> = ft.FilterTransform<A, EnvT>;

export type ExtractionRule = (ra: ExtractionTask<unknown, ExtractionEnv>) => ExtractionTask<unknown, ExtractionEnv>;
