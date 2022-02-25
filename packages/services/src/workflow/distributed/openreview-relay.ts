import _ from 'lodash';

import axios from 'axios';
import Async from 'async';

import {
  AxiosRequestConfig,
  AxiosInstance
} from 'axios';

import {
  CommLink,
  defineSatelliteService, SatelliteService
} from '@watr/commlinks';
import { ErrorRecord, URLRequest } from '../common/datatypes';
import { CanonicalFieldRecords } from '@watr/field-extractors';
import { WorkflowConductor } from './workers';
import { initConfig, prettyPrint } from '@watr/commonlib';

interface User {
  id: string;
}

interface Credentials {
  token: string;
  user: User;
}

interface NoteContent {
  'abstract': string;
  html: string; // this is a URL
}
interface Note {
  id: string;
  content: NoteContent;
}
interface Notes {
  notes: Note[];
  count: number;
}
// interface QueryFields {
//   invitation: 'dblp.org/-/record';
//   sort: 'number:desc';
//   offset: number;
// }

const config = initConfig();

const OpenReviewAPIBase = config.get('openreview:restApi');

class OpenReviewRelay {
  credentials?: Credentials;
  commLink: CommLink<SatelliteService<OpenReviewRelay>>;
  constructor(commLink: CommLink<SatelliteService<OpenReviewRelay>>) {
    this.commLink = commLink;
  }

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
  }

  configAxios(): AxiosInstance {
    const conf = this.configRequest();
    return axios.create(conf);
  }

  async getCredentials(): Promise<Credentials> {
    if (this.credentials !== undefined) {
      return this.credentials;
    }
    const user = config.get('openreview:restUser');
    const password = config.get('openreview:restPassword');
    const creds = await this.postLogin(user, password);
    this.credentials = creds;
    return creds;
  }

  async postLogin(user: string, password: string): Promise<Credentials> {
    return this.configAxios()
      .post("/login", { user, password })
      .then(r => r.data);
  }


  async doUpdateNote(): Promise<void> {

  }

  async apiGET<R>(url: string, query: Record<string, string | number>, retries: number = 0): Promise<R | undefined> {
    return this.configAxios()
      .get(url, { params: query })
      .then(response => {
        const { data } = response;
        prettyPrint({ data })
        return data;
      })
      .catch(error => {
        prettyPrint({ msg: 'error!', errorType: typeof Error })
        this.credentials = undefined;
        this.commLink.log.warn(`apiGET ${url}: retries=${retries} `)
        if (retries > 1) {
          return undefined;
        }
        return this.apiGET(url, query, retries+1);
      });
  }

  async doFetchNotes(): Promise<Notes> {
    const offset = 0;
    return this.apiGET<Notes>('/notes', { invitation: 'dblp.org/-/record', sort: 'number:desc', offset })
  }

  async doRunRelay(): Promise<void> {
    const { notes, count } = await this.doFetchNotes();

    Async.eachOfSeries(notes, async (note: Note) => {
      const abs = note.content['abstract'];
      if (abs !== undefined) {
        return;
      }
      const url = note.content['html'];
      const arg = URLRequest(url);
      const res: CanonicalFieldRecords | ErrorRecord = await this.commLink.call(
        'runOneURLNoDB', arg, { to: WorkflowConductor.name }
      );
      if ('error' in res) {

        return;
      }
      res.fields
    })
  }


}


// Pull data from OpenReview into abstract finder and post the
//   results back via HTTP/Rest API
export const OpenReviewRelayService = defineSatelliteService<OpenReviewRelay>(
  'OpenReviewRelayService',
  async (commLink) => {
    return new OpenReviewRelay(commLink);
  }, {
  async networkReady() {
    await this.cargo
      .getCredentials()
      .catch(error => {
        this.log.warn(`Error: ${error}`);
      });
  },
  async startup() {
    await this.cargo
      .doRunRelay()
      .catch(error => {
        this.log.warn(`Error: ${error}`);
      });
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
//                         client = openreview.Client(baseurl = 'https://api.openreview.net', username = 'OpenReview.net', password = '')
//                         r=client.post_note(note)
//         else:
//             print('Error', url, response)


