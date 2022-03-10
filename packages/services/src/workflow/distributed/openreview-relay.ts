import _ from 'lodash';

import Async from 'async';

import axios from 'axios';
import { AxiosError } from 'axios';
type ErrorTypes = AxiosError | unknown;


import {
  AxiosRequestConfig,
  AxiosInstance
} from 'axios';

import {
  CommLink,
  CustomHandler,
  defineSatelliteService,
  SatelliteService
} from '@watr/commlinks';
import { toUrl, URLRequest } from '../common/datatypes';
import { WorkflowConductor } from './workers';
import { delay, getEnvMode, initConfig, isTestingEnv, prettyFormat, prettyPrint } from '@watr/commonlib';
import { Logger } from 'winston';
import { asyncEachOfSeries } from '~/util/async-plus';
import { CanonicalFieldRecords, ExtractionErrors } from '@watr/field-extractors';

interface User {
  id: string;
}

interface Credentials {
  token: string;
  user: User;
}

interface NoteContent {
  'abstract'?: string;
  html?: string; // this is a URL
  venueid: string;
}
interface Note {
  id: string;
  content: NoteContent;
}
interface Notes {
  notes: Note[];
  count: number;
}

interface NoteBatch {
  notes: Note[];
  initialOffset: number;
  finalOffset: number;
  availableNoteCount: number;
  summary: Record<string, number>;
  errors: string[];
}

type NumNumNum = [number, number, number];

const config = initConfig();

const OpenReviewAPIBase = config.get('openreview:restApi');

interface OpenReviewRelay {
  credentials?: Credentials;
  commLink: CommLink<SatelliteService<OpenReviewRelay>>;
  log: Logger;
  networkReady: CustomHandler<OpenReviewRelay, unknown, unknown>;
  startup: CustomHandler<OpenReviewRelay, unknown, unknown>;
  shutdown: CustomHandler<OpenReviewRelay, unknown, unknown>;

  configRequest(): AxiosRequestConfig;
  configAxios(): AxiosInstance;
  getCredentials(): Promise<Credentials>;
  postLogin(user: string, password: string): Promise<Credentials>;
  doUpdateNote(note: Note, abs: string, retries?: number): Promise<void>;
  apiGET<R>(url: string, query: Record<string, string | number>, retries?: number): Promise<R | undefined>;
  doFetchNotes(offset: number): Promise<Notes | undefined>;
  doRunRelay(offset?: number, batchSize?: number): Promise<void>;
  attemptExtractNote(
    note: Note,
    byHostSuccFailSkipCounts: Record<string, NumNumNum>,
    byHostErrors: Record<string, Set<string>>
  ): Promise<string | undefined>;

  createNoteBatch(_offset: number, batchSize: number): Promise<NoteBatch>;
}



// Pull data from OpenReview into abstract finder and post the
//   results back via HTTP/Rest API
export const OpenReviewRelayService = defineSatelliteService<OpenReviewRelay>(
  'OpenReviewRelayService',
  async (commLink) => {
    const relay = newOpenReviewRelay(commLink);
    return relay;
  });


function isAxiosError(error: any): error is AxiosError {
  return error['isAxiosError'] !== undefined && error['isAxiosError'];
}

function displayRestError(error: ErrorTypes): void {
  if (isAxiosError(error)) {
    console.log('HTTP Request Error: ');
    const { response } = error;
    if (response !== undefined) {
      const { status, statusText, data } = response;
      console.log(`Error: ${status}/${statusText}`);
      console.log(data);
    }
    return;
  }

  console.log(error);
}

function newOpenReviewRelay(
  commLink: CommLink<SatelliteService<OpenReviewRelay>>,
) {

  const relay: OpenReviewRelay = {
    credentials: undefined,
    commLink,
    log: commLink.log,
    async networkReady() {
      console.log('inside OpenReviewRelay networkReady')

      await this
        .getCredentials()
        .catch(error => {
          this.log.error(`Error: ${error}`);
        });
    },
    async startup() {
      this.commLink.log.info('relay startup');
      await this
        .doRunRelay()
        .catch(error => {
          this.log.warn(`Error: ${error}`);
        });
    },
    async shutdown() {
    },

    configRequest(): AxiosRequestConfig {
      let auth = {};
      if (this.credentials) {
        auth = {
          Authorization: `Bearer ${this.credentials.token}`
        };
      }

      const config: AxiosRequestConfig = {
        baseURL: OpenReviewAPIBase,
        headers: {
          "User-Agent": "open-extraction-service",
          ...auth
        },
        timeout: 10000,
        responseType: "json"
      };

      return config;
    },

    configAxios(): AxiosInstance {
      const conf = this.configRequest();
      return axios.create(conf);
    },

    async getCredentials(): Promise<Credentials> {
      if (this.credentials !== undefined) {
        return this.credentials;
      }
      const user = config.get('openreview:restUser');
      const password = config.get('openreview:restPassword');

      this.commLink.log.info(`Logging in as User: ${user}`)
      if (user === undefined || password === undefined) {
        return Promise.reject(new Error(`Openreview API: user or password not defined`))
      }
      const creds = await this.postLogin(user, password);

      this.log.info(`Logged in as ${creds.user}`);

      this.credentials = creds;
      return creds;
    },

    async postLogin(user: string, password: string): Promise<Credentials> {
      return this.configAxios()
        .post("/login", { id: user, password })
        .then(r => r.data)
        .catch(displayRestError)
    },


    async doUpdateNote(note: Note, abs: string, retries: number = 0): Promise<void> {
      const noteUpdate = {
        referent: note.id,
        content: {
          'abstract': abs
        },
        invitation: 'dblp.org/-/abstract',
        readers: ['everyone'],
        writers: [],
        signatures: ['dblp.org']
      }
      this.log.info(`POSTing updated note ${note.id}`);
      await this.getCredentials()
      await this.configAxios()
        .post("/notes", noteUpdate)
        .then(r => {
          const updatedNote: Note = r.data;
          this.log.info(`updated Note ${note.id}; updateId: ${updatedNote.id}`)
        })
        .catch(error => {
          displayRestError(error);
          this.commLink.log.warn(`doUpdateNote ${note.id}: retries=${retries} `)
          if (retries > 1) {
            return undefined;
          }
          this.doUpdateNote(note, abs, retries + 1);
        })
    },

    async apiGET<R>(url: string, query: Record<string, string | number>, retries: number = 0): Promise<R | undefined> {
      await this.getCredentials()
      return this.configAxios()
        .get(url, { params: query })
        .then(response => {
          const { data } = response;
          return data;
        })
        .catch(error => {
          displayRestError(error);
          this.credentials = undefined;
          this.commLink.log.warn(`apiGET ${url}: retries=${retries} `)
          if (retries > 1) {
            return undefined;
          }
          return this.apiGET(url, query, retries + 1);
        });
    },

    async doFetchNotes(offset: number): Promise<Notes | undefined> {
      return this.apiGET<Notes>('/notes', { invitation: 'dblp.org/-/record', sort: 'number:desc', offset })
    },

    async doRunRelay(offset: number = 0, batchSize: number = 200): Promise<void> {
      this.log.info(`Running Openreview -> abstract finder; mode=${getEnvMode()}`)
      const self = this;
      const byHostSuccFailSkipCounts: Record<string, NumNumNum> = {};
      const byHostErrors: Record<string, Set<string>> = {};

      let nextOffset = offset;
      const iterations = isTestingEnv() ? 2 : 0;
      let iteration = 0;
      const runForever = iterations === 0;

      async function run(): Promise<boolean> {
        iteration += 1;
        self.log.info(`Running batch #${iteration}`)
        if (!runForever && iteration >= iterations) {
          self.log.info(`Finished after specified ${iteration} batches`);
          return false;
        }
        const noteBatch = await self.createNoteBatch(nextOffset, batchSize);
        prettyPrint({ 'batchSummary': noteBatch.summary });

        let { notes, finalOffset } = noteBatch;
        if (notes.length === 0) {
          self.log.info(`No more notes to process`);
          return false;
        }
        nextOffset = finalOffset;

        if (isTestingEnv()) {
          const someNotes = notes.slice(0, 2);
          notes = someNotes;
        }

        const maxRate = 5 * 1000;// 5 second max spidering rate

        let currTime = Date.now();

        await asyncEachOfSeries(notes, async (note: Note) => {
          const url = note.content.html || '';
          const isArxivLink = /arxiv\.org/.test(url);
          if (isArxivLink) {
            self.log.info(`Skipping arxiv.org link`);
            return;
          };

          const elapsed = Date.now() - currTime;
          const waitTime = maxRate - elapsed;

          if (waitTime > 0) {
            self.log.info(`Delaying ${waitTime / 1000} seconds...`);
            await delay(waitTime);
          }
          currTime = Date.now();
          const maybeAbs = await self.attemptExtractNote(note, byHostSuccFailSkipCounts, byHostErrors);
          if (maybeAbs === undefined) {
            return;
          }
          await self.doUpdateNote(note, maybeAbs);
        });

        prettyPrint({ byHostSuccFailSkipCounts, byHostErrors });
        return true;
      }

      await Async.doWhilst(
        Async.asyncify(run),
        Async.asyncify(async (shouldContinue: boolean) => shouldContinue)
      );
    },

    async attemptExtractNote(
      note: Note,
      byHostSuccFailSkipCounts: Record<string, NumNumNum>,
      byHostErrors: Record<string, Set<string>>
    ): Promise<string | undefined> {
      this.commLink.log.debug(`attemptExtractNote(${note.id}, ${note.content.html})`);

      const urlstr = note.content['html'];

      if (!_.isString(urlstr)) {
        const prevErrors: Set<string> = _.get(byHostErrors, ['_no.host_'], new Set());
        prevErrors.add(`note.content.html is undefined`);
        _.set(byHostErrors, ['_no.host_'], prevErrors);
        return undefined;
      }
      const url = toUrl(urlstr);
      if (typeof url === 'string') {
        const prevErrors: Set<string> = _.get(byHostErrors, ['_bad.url_'], new Set());
        prevErrors.add(url)
        _.set(byHostErrors, ['_bad.url'], prevErrors);
        return undefined;
      }


      let errors = _.get(byHostErrors, [url.hostname], new Set<string>());
      _.set(byHostErrors, [url.hostname], errors);

      const [prevSucc, prevFail, prevSkip] = _.get(byHostSuccFailSkipCounts, [url.hostname], [0, 0, 0] as const);
      const arg = URLRequest(urlstr);

      const maxFailsPerDomain = 10;
      if (prevFail > maxFailsPerDomain) {
        // don't keep processing failed domains
        errors.add(`Previous failure count > ${maxFailsPerDomain}; skipping.`)
        byHostSuccFailSkipCounts[url.hostname] = [prevSucc, prevFail, prevSkip + 1];
        return undefined;
      }

      if (/arxiv\.org/.test(url.hostname)) {
        this.commLink.log.info(`Skipping arxiv.org domain: ${urlstr}`);
        byHostSuccFailSkipCounts[url.hostname] = [prevSucc, prevFail, prevSkip + 1];
        return undefined;
      }

      const res: CanonicalFieldRecords | ExtractionErrors = await this.commLink.call(
        'runOneURLNoDB', arg, { to: WorkflowConductor.name }
      );

      const pfres = prettyFormat(res)
      this.commLink.log.debug(`runOneURLNoDB() => ${pfres}`);

      const adjustedUrlStr = res.finalUrl ? res.finalUrl : urlstr;
      const adjustedUrl = toUrl(adjustedUrlStr)
      const adjustedHostname = typeof adjustedUrl === 'string' ? url.hostname : `${adjustedUrl.hostname} (via ${url.hostname})`;
      errors = _.get(byHostErrors, [adjustedHostname], new Set<string>());
      _.set(byHostErrors, [adjustedHostname], errors);

      if ('errors' in res) {
        res.errors.forEach(e => errors.add(e));
        byHostSuccFailSkipCounts[adjustedHostname] = [prevSucc, prevFail + 1, prevSkip];
        return;
      }

      const abstracts = res.fields.filter((rec) => {
        return rec.name === 'abstract';
      });

      const abstractsClipped = res.fields.filter((rec) => {
        return rec.name === 'abstract-clipped'
      });

      const hasAbstract = abstracts.length > 0 || abstractsClipped.length > 0;
      if (!hasAbstract) {
        errors.add('no abstract found');
        byHostSuccFailSkipCounts[adjustedHostname] = [prevSucc, prevFail + 1, prevSkip];
        return;
      }

      byHostSuccFailSkipCounts[adjustedHostname] = [prevSucc + 1, prevFail, prevSkip];
      const abstrct = abstracts[0] || abstractsClipped[0];

      return abstrct.value;
    },

    async createNoteBatch(_offset: number, batchSize: number): Promise<NoteBatch> {
      const log = this.commLink.log;
      let offset = _offset;
      const self = this;

      const notesWithUrlNoAbs: Note[] = [];
      const notesWithAbstracts: Note[] = [];
      const notesWithoutUrls: Note[] = [];
      log.info(`CreateNoteBatch: offset: ${offset}, batchSize: ${batchSize} ...`)
      let availableNoteCount = 0;

      await Async.doUntil(
        Async.asyncify(async function(): Promise<number> {
          try {
            const nextNotes = await self.doFetchNotes(offset);
            if (nextNotes === undefined) {
              return Promise.reject(new Error('doFetchNotes() return undefined'));
            }

            const { notes, count } = nextNotes;

            if (notes.length === 0) return 0;

            const note0: Note | undefined = _.head(notes);
            const noteN: Note | undefined = _.last(notes);
            const id0 = note0 ? note0.id : 'error';
            const idN = noteN ? noteN.id : 'error';

            log.info(`fetched ${notes.length} (of ${count}) notes. First/Last= ${id0} / ${idN}`)

            availableNoteCount = count;
            offset += notes.length;

            notes.forEach(note => {
              const { content } = note;
              const abs = content.abstract;
              const { html } = content;
              if (html === undefined) {
                notesWithoutUrls.push(note);
                return;
              }
              if (abs === undefined) {
                notesWithUrlNoAbs.push(note);
                return;
              }
              notesWithAbstracts.push(note);
            });
            return notes.length;
          } catch (error) {
            return Promise.reject(error);
          }
        }),
        Async.asyncify(async function test(fetchLength: number): Promise<boolean> {
          const atBatchLimit = notesWithUrlNoAbs.length >= batchSize;
          const doneFetching = fetchLength === 0;
          log.info(`CreateBatch: until fetchLength(=${fetchLength})===0 || processableNotes(=${notesWithUrlNoAbs.length}) >= batchLimit(=${batchSize})`)
          return doneFetching || atBatchLimit;
        })
      );
      const notesWithUrlNoAbsLen = notesWithUrlNoAbs.length;
      const notesWithAbstractsLen = notesWithAbstracts.length;
      const notesWithoutUrlsLen = notesWithoutUrls.length;

      const noteCounts: Record<string, number> = {
        notesWithUrlNoAbsLen,
        notesWithAbstractsLen,
        notesWithoutUrlsLen
      };

      const byHostCounts: Record<string, number> = {};

      const errors: string[] = [];

      notesWithUrlNoAbs.forEach(note => {
        const html = note.content.html;
        if (html === undefined) return;
        const url = toUrl(html);
        if (typeof url === 'string') {
          errors.push(url);
          return;
        }
        const { hostname } = url;
        const prevCount = byHostCounts[hostname];
        const newCount = prevCount === undefined ? 1 : prevCount + 1;
        byHostCounts[hostname] = newCount;
      });

      const summary = _.merge(noteCounts, byHostCounts);

      const noteBatch: NoteBatch = {
        notes: notesWithUrlNoAbs,
        initialOffset: _offset,
        finalOffset: offset,
        availableNoteCount,
        summary,
        errors
      }

      return noteBatch;
    }
  };
  return relay;
}
