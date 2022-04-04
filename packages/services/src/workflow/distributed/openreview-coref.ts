import _ from 'lodash';

// import bibtexParser from '@retorquere/bibtex-parser';
import { Bibliography, Entry, parse as parseBibtex } from '@retorquere/bibtex-parser';
import {
  AxiosRequestConfig,
  AxiosInstance,
  AxiosError
} from 'axios';

import {
  CommLink,
  CustomHandler,
  defineSatelliteService,
  SatelliteService
} from '@watr/commlinks';
import { Logger } from 'winston';
import { asyncDoUntil, asyncEachSeries } from '~/util/async-plus';
import { newOpenReviewExchange, Note, Notes, OpenReviewExchange } from './openreview-exchange';

import { prettyFormat, prettyPrint } from '@watr/commonlib';
import { CorefPaperModel, CorefSignatureModel, createCollections } from '~/db/mongodb';
import { BracedComment, RegularCommand } from '@retorquere/bibtex-parser/grammar';

export interface OpenReviewCoref {
  openReviewExchange: OpenReviewExchange;

  commLink: CommLink<SatelliteService<OpenReviewCoref>>;
  log: Logger;
  networkReady: CustomHandler<OpenReviewCoref, unknown, unknown>;
  startup: CustomHandler<OpenReviewCoref, unknown, unknown>;
  shutdown: CustomHandler<OpenReviewCoref, unknown, unknown>;

  doFetchNotes(offset: number): Promise<Notes | undefined>;
  updateAuthorCorefDB(limit: number): Promise<void>;
}

export const OpenReviewCorefService = defineSatelliteService<OpenReviewCoref>(
  'OpenReviewCorefService',
  async (commLink) => {
    return newOpenReviewCoref(commLink);
  });


function newOpenReviewCoref(
  commLink: CommLink<SatelliteService<OpenReviewCoref>>,
) {

  const relay: OpenReviewCoref = {
    openReviewExchange: newOpenReviewExchange(commLink.log),
    commLink,
    log: commLink.log,
    async networkReady() {
      console.log('inside OpenReviewCoref networkReady')

      await this.openReviewExchange
        .getCredentials()
        .catch(error => {
          this.log.error(`Error: ${error}`);
        });
    },
    async startup() {
      this.commLink.log.info('relay startup');
    },
    async shutdown() {
    },

    async doFetchNotes(offset: number): Promise<Notes | undefined> {
      return this.openReviewExchange.apiGET<Notes>('/notes', { invitation: 'dblp.org/-/record', sort: 'number:desc', offset })
    },

    async updateAuthorCorefDB(limit: number): Promise<void> {
      this.log.info('Connected to MongoDB');
      const log = this.log;
      let offset = 0;
      const batchSize = 100;
      const self = this;

      let availableNoteCount = 0;
      let notesProcessed = 0;
      const noteLimit = limit;
      const hasNoteLimit = noteLimit > 0;

      await asyncDoUntil(
        async function (): Promise<number> {
          try {
            const nextNotes = await self.doFetchNotes(offset);
            if (nextNotes === undefined) {
              return Promise.reject(new Error('doFetchNotes() return undefined'));
            }

            const { notes, count } = nextNotes;

            if (notes.length === 0) return 0;

            log.info(`Fetched ${notes.length} of ${count} notes.`);

            availableNoteCount = count;
            offset += notes.length;

            await asyncEachSeries(notes, async (note: Note) => {
              if (hasNoteLimit && notesProcessed >= noteLimit) return;
              notesProcessed += 1;
              const msg = `===  Processing ${note.id} ${note.content.title} ===`;
              log.info(msg)
              const { content, id } = note;
              const paperId = id;
              const abs = content.abstract;
              const { title, authorids, authors, venue } = content;
              const authorsRec = _.zip(authorids, authors).map(([authorid, author_name], position) => {
                if (author_name === undefined) return;
                if (authorid === undefined || authorid === null) {
                  authorid = author_name;
                }
                return {
                  position,
                  author_name,
                  authorid
                };
              });

              const bibtexstr = note.content._bibtex;
              const bibtex: Bibliography = parseBibtex(bibtexstr, {
                unknownCommandHandler: (node: RegularCommand) => {
                  const { loc, source } = node;

                  const comment: BracedComment = {
                    kind: 'BracedComment',
                    loc,
                    source,
                    value: '_',
                  };
                  return comment;

                }
              });

              const maybeYears = bibtex.entries.flatMap((bibEntry: Entry) => {
                const yearFields = bibEntry.fields['year'];
                return yearFields ? yearFields : [];
              });

              const year = maybeYears.length > 0 ? maybeYears[0] : null;

              const corefPaper = new CorefPaperModel({
                paper_id: paperId,
                title,
                abstract: typeof abs === 'string' ? abs : null,
                venue,
                authors: authorsRec,
                journal_name: null,
                year,
                references: []
              });
              await corefPaper.save()
                .then(p => {
                  const msg = `Saved ${p.paper_id} ${p.title}`;
                  log.info(msg);
                })
                .catch(error => {
                  log.error(`Error saving corefSignatureRecord ${error}`)
                  prettyPrint({ note })
                });


              await asyncEachSeries(authorsRec, async (rec) => {
                if (rec === undefined) return;
                const { authorid, author_name, position } = rec;
                log.info(`saving author of note ${author_name}`)
                const openId = authorid;
                const fullname = author_name;
                const authorId = `${paperId}_${position}`
                const signatureId = authorId;
                // TODO this name splitting should be replaced later:

                const nameParts = fullname.split(/[ ]+/);
                if (nameParts.length === 0) {
                  log.info(`No Name could be parsed from note \n ${prettyFormat(note)} `);
                  return;
                };

                const firstName = nameParts[0];
                const lastName = nameParts[nameParts.length - 1];
                const firstInitial = firstName[0];
                const block = `${firstInitial} ${lastName}`.toLowerCase();
                let middleName = null;
                if (nameParts.length > 2) {
                  const middleParts = nameParts.slice(1, nameParts.length - 1);
                  middleName = middleParts.join(' ')
                }

                // use github datamade/probablepeople in python to get f/m/l parts
                const corefSignatureRecord = new CorefSignatureModel({
                  paper_id: paperId,
                  "author_id": authorId,
                  "signature_id": signatureId,
                  author_info: {
                    position,
                    block,
                    given_block: block,
                    first: firstName,
                    last: lastName,
                    middle: middleName,
                    suffix: null,
                    affiliations: [],
                    email: null,
                    // Not required by S2AND, used internally:
                    fullname,
                    openId,
                  }
                });

                await corefSignatureRecord.save()
                  .catch(error => {
                    log.error(`Error saving corefSignatureRecord ${error}`)
                    prettyPrint({ note })
                  });
              });

            })
            return notes.length;
          } catch (error) {
            return Promise.reject(error);
          }
        },
        async function test(fetchLength: number): Promise<boolean> {
          const doneFetching = fetchLength === 0;
          const reachedLimit = noteLimit > 0 && notesProcessed >= noteLimit;
          return doneFetching || reachedLimit;
        }
      );

    }
  };
  return relay;
}

import { arglib } from '@watr/commonlib';
const { opt, config, registerCmd } = arglib;

import { connectToMongoDB } from '~/db/mongodb';
import { newCommLink } from '@watr/commlinks';

export function registerCLICommands(yargv: arglib.YArgsT) {
  registerCmd(
    yargv,
    'coref-init-db',
    'Populate MongoDB with signatures from Openreview',
    config(
      opt.ion('limit: Max number of papers to add to db, 0==all', {
        type: 'number',
        demandOption: true
      }),
    )
  )(async (args: any) => {
    const { limit } = args;
    const conn = await connectToMongoDB();
    await conn.connection.dropDatabase();

    await createCollections();

    const commLink = newCommLink<SatelliteService<OpenReviewCoref>>("CorefService");
    const corefService = await OpenReviewCorefService.cargoInit(commLink);
    await corefService.updateAuthorCorefDB(limit);
    console.log('done updateAuthorCorefDB')
    await conn.disconnect();
    await commLink.quit()
    console.log('disconnected...')
  });

}
