import _ from 'lodash';
import { asyncEachOfSeries } from '@watr/commonlib';
import { HostStatus, NoteStatus } from './schemas';

export async function populateDBHostNoteStatus(n: number) {
    await asyncEachOfSeries(
        _.range(n),
        async (index: number) => {
            const validUrl = index % 3 === 0;
            const url = validUrl ? `http://host-${index % 5}/page/${index}` : 'no-url';
            const noteStatus = new NoteStatus({
                noteId: `note#${index}`,
                validUrl,
                url
            });
            await noteStatus.save();
        }
    );
    await asyncEachOfSeries(
        _.range(n),
        async (index: number) => {
            const validUrl = index % 3 === 0;
            if (!validUrl) {
                return;
            }
            const host = `http://host-${index % 5}`;
            const url = `${host}/page/${index}`;
            const httpStatus = (((index % 4) + 2) * 100) + (index % 3)

            const hostStatus = new HostStatus({
                noteId: `note#${index}`,
                hasAbstract: index % 9 === 0,
                validResponseUrl: true,
                requestUrl: url,
                response: url,
                responseHost: host,
                httpStatus,
            });
            await hostStatus.save();
        }
    );

}
