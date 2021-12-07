import _ from 'lodash';

import { pipe } from 'fp-ts/function';
import { fold } from 'fp-ts/Either';
import { isRight } from 'fp-ts/lib/Either';
import * as io from 'io-ts';
import pumpify from 'pumpify';
import { Stream } from 'stream';

import { csvStream } from '~/util/parse-csv';
import { throughFunc } from '~/util/stream-utils';


/// / The Initial Record supplied by the OpenReview team
// interface AlphaRecord {
//   noteId: string;
//   dblpConfId: string;
//   url: string;
//   title?: string;
//   authorId?: string;
// }

const AlphaRecordReq = io.type({
  noteId: io.string,
  url: io.string,
});

const AlphaRecordOpt = io.partial({
  dblpConfId: io.string,
  title: io.string,
  authorId: io.string
});

const AlphaRecordT = io.exact(io.intersection([AlphaRecordReq, AlphaRecordOpt]));

export type AlphaRecord = io.TypeOf<typeof AlphaRecordT>;

export const AlphaRecord = {
  decode(input: unknown): AlphaRecord | string {
    const decoded = AlphaRecordT.decode(input);
    if (isRight(decoded)) return decoded.right;

    const paths = getPaths(decoded);
    const err = _.join(paths, '; ');
    return `Error parsing record at paths: ${err}`;
  }
};


const getPaths = <A>(v: io.Validation<A>): Array<string> => {
  return pipe(
    v,
    fold(
      (errors) => errors.map((error) => error.context.map(({ key }) => key).join('.')),
      () => ['no errors']
    )
  );
};


export function readAlphaRecStream(csvfile: string): Stream {
  const inputStream = csvStream(csvfile);

  return pumpify.obj(
    inputStream,
    throughFunc((csvRec: string[]) => {
      const [noteId, dblpConfId, title, url, authorId] = csvRec;
      return {
        noteId, dblpConfId, url, title, authorId
      };
    }),
  );
}
