import _ from 'lodash';
import { HostStatus, HostStatusUpdateFields, NoteStatus } from './schemas';
import { validateUrl } from '~/workflow/common/datatypes';
import * as E from 'fp-ts/Either';


type upsertNoteStatusArgs = {
    noteId: string,
    urlstr?: string
}

export async function upsertNoteStatus({
    noteId, urlstr
}: upsertNoteStatusArgs): Promise<NoteStatus> {
    const maybeUrl = validateUrl(urlstr);
    const validUrl = E.isRight(maybeUrl);

    const urlOrErrStr = E.fold<string, URL, string>(
        () => `Invalid URL: ${urlstr}`,
        success => success.toString()
    )(maybeUrl);

    return NoteStatus.findOneAndUpdate(
        { _id: noteId },
        { _id: noteId, validUrl, url: urlOrErrStr },
        {new: true, upsert: true}
    );
}

export async function upsertHostStatus(noteId: string, fields: HostStatusUpdateFields): Promise<HostStatus> {
    return HostStatus.findOneAndUpdate(
        { _id: noteId },
        fields,
        {new: true, upsert: true}
    );
}
