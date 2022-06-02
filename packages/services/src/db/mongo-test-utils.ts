import _ from 'lodash';
import { asyncEachOfSeries } from '@watr/commonlib';
import { upsertHostStatus, upsertNoteStatus } from './query-api';
import * as fc from 'fast-check';
import { WorkflowStatuses } from './schemas';

export async function populateDBHostNoteStatus(n: number) {
  await asyncEachOfSeries(
    _.range(n),
    async (index: number) => {
      const validUrl = index % 3 === 0;
      const urlstr = validUrl ? `http://host-${index % 5}/page/${index}` : 'no-url';
      await upsertNoteStatus({
        noteId: `note#${index}`,
        urlstr
      });

      const wi = index % WorkflowStatuses.length;
      const workflowStatus = WorkflowStatuses[wi];
      if (validUrl) {
        const httpStatus = (((index % 4) + 2) * 100) + (index % 3);
        await upsertHostStatus(
          `note#${index}`,
          workflowStatus, {
            hasAbstract: index % 9 === 0,
            requestUrl: urlstr,
            response: urlstr,
            httpStatus
          });

      }
    }
  );
}

const a200s = Array(20).fill(200);
const a404s = Array(4).fill(200);
const aCodes = _.concat(a200s, a404s, [301, 302, 500]);
export const genHttpStatus = fc.oneof(
  ...(aCodes.map(n => fc.constant(n)))
);
