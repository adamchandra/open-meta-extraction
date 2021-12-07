import _ from 'lodash';

import { UrlFetchData } from '@watr/spider';
import { Logger } from 'winston';
import { Browser, Page } from 'puppeteer';
import * as ft from '../core/function-defs';

import { ExtractionEvidence, Field } from '../core/extraction-records';

export interface NormalForms {
  'css-norm': null;
  'original': null;
  'tidy-norm': null
}

export type NormalForm = keyof NormalForms;

export interface FieldCandidate {
  text: string;
  evidence: string[];
  // merged: FieldCandidate[]; ??
}


export type ExtractionEnv = {
  log: Logger;
  ns: string[];
  entryPath: string;
  metadata: UrlFetchData;
  fieldRecs: Record<string, Field[]>;
  fields: Field[];
  evidence: ExtractionEvidence[];
  fieldCandidates: FieldCandidate[];
  fileContentCache: Record<string, string>;
  browserPageCache: Record<string, Page>;
  browser: Browser;
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
  Arrow,
  ExtractionResult,
  asW,
  forEachDo,
  takeFirstSuccess,
  takeWhileSuccess,
  gatherSuccess,
} = fp;

export type ControlCode = ft.ControlCode;
export type ControlInstruction = ft.ControlInstruction;

type EnvT = ExtractionEnv;

export type W<A> = ft.W<A, EnvT>;
export type WCI = ft.WCI<EnvT>;
export type Perhaps<A> = ft.Perhaps<A>;
export type PerhapsW<A> = ft.PerhapsW<A, EnvT>;
export type ClientFunc<A, B> = ft.ClientFunc<A, B, EnvT>;
export type ControlFunc = ft.ControlFunc<EnvT>;
export type ClientResult<A> = ft.ClientResult<A>;
export type ExtractionResult<A> = ft.ExtractionResult<A, EnvT>;
export type Arrow<A, B> = ft.Arrow<A, B, EnvT>;
export type ExtractionFunction<A, B> = ft.ExtractionFunction<A, B, EnvT>;
export type FilterArrow<A> = ft.FilterArrow<A, EnvT>;
export type FilterFunction<A> = ft.FilterFunction<A, EnvT>;
export type EnvFunction<A> = ft.EnvFunction<A, EnvT>;

