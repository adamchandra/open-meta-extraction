import _ from 'lodash';
import { asyncEachOfSeries } from '@watr/commonlib';
import { upsertHostStatus, upsertNoteStatus } from './query-api';

export async function populateDBHostNoteStatus(n: number) {
    await asyncEachOfSeries(
        _.range(n),
        async (index: number) => {
            const validUrl = index % 3 === 0;
            const urlstr = validUrl ? `http://host-${index % 5}/page/${index}` : 'no-url';
            await upsertNoteStatus({
                noteId: `note#${index}`,
                urlstr
            })

            if (validUrl) {
                const httpStatus = (((index % 4) + 2) * 100) + (index % 3)
                await upsertHostStatus(
                    `note#${index}`,
                    'available', {
                    hasAbstract: index % 9 === 0,
                    requestUrl: urlstr,
                    response: urlstr,
                    httpStatus
                });

            }
        }
    );
}
