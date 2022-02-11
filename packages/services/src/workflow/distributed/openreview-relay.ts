import _ from 'lodash';

import {
    defineSatelliteService
} from '@watr/commlinks';

interface OpenReviewRelay {

}

// Pull data from OpenReview into abstract finder and post the
// results back via HTTP/Rest API
export const OpenReviewRelay = defineSatelliteService<undefined>(
    'OpenReviewRelay',
    () => undefined, {
    async networkReady() {
    },
    async startup() {
    },
    async shutdown() {
    }
});

// # We use the Super User, but we are going to create a separate user just for this script
// client = openreview.Client(baseurl = 'https://api.openreview.net', username = 'OpenReview.net', password = '')
//
// # Notes that will be updated with an abstract if they don't have one
// dblp_notes=openreview.tools.iterget_notes(client, invitation='dblp.org/-/record', sort='number:desc')
//
// for note in tqdm(dblp_notes):
//     if not note.content.get('abstract') and note.content.get('html'):
//         noteId=note.id
//         url=note.content['html']
//
//         # 10.128.0.33 is the local IP address of the server that hosts the abstract extraction service
//         response=requests.post('http://10.128.0.33/extractor/record.json', json={
//          "noteId": noteId,
//           "url": url
//         })
//
//         if response.status_code == 502:
//             print(f'{url}: 502 error, wait for 20 seconds and try again...')
//             time.sleep(20)
//             response=requests.post('http://10.128.0.33/extractor/record.json', json={
//              "noteId": noteId,
//               "url": url
//             })
//
//         if response.status_code == 200:
//             json_response = response.json()
//             for f in json_response.get('fields', []):
//                 if 'abstract' in f['name']:
//                     #print(noteId, f['value'])
//                     note = openreview.Note(
//                                 referent=noteId,
//                                 content={
//                                     'abstract': f['value']
//                                 },
//                                 invitation='dblp.org/-/abstract',
//                                 readers = ['everyone'],
//                                 writers = [],
//                                 signatures = ['dblp.org'])
//                     try:
//                         r=client.post_note(note)
//                     except:
//                         # If it fails because the token of the client expired, we retry with a new token
//                         client = openreview.Client(baseurl = 'https://api.openreview.net', username = 'OpenReview.net', password = 'grav1tyIs981cms2')
//                         r=client.post_note(note)
//         else:
//             print('Error', url, response)
