/*
 * Interface to communicate with OpenReview
 */

import _ from 'lodash';
import axios from 'axios';

import {
  AxiosRequestConfig,
  AxiosInstance,
  AxiosError
} from 'axios';

type ErrorTypes = AxiosError | unknown;

import {
  getServiceLogger,
  initConfig,
  prettyFormat,
  prettyPrint,
  putStrLn
} from '@watr/commonlib';

import { Logger } from 'winston';
import { ClientRequest } from 'http';

export interface User {
  id: string;
}

export interface Credentials {
  token: string;
  user: User;
}

export class OpenReviewExchange {
  credentials?: Credentials;
  user: string;
  password: string;
  apiBaseURL: string;
  log: Logger;

  constructor() {
    const config = initConfig();
    this.log = getServiceLogger('OpenReviewExchange')
    this.apiBaseURL = config.get('openreview:restApi');
    this.user = config.get('openreview:restUser');
    this.password = config.get('openreview:restPassword');
  }


  configRequest(): AxiosRequestConfig {
    let auth = {};
    if (this.credentials) {
      auth = {
        Authorization: `Bearer ${this.credentials.token}`
      };
    }

    const reqconfig: AxiosRequestConfig = {
      baseURL: this.apiBaseURL,
      headers: {
        'User-Agent': 'open-extraction-service',
        ...auth
      },
      timeout: 10000,
      responseType: 'json'
    };

    return reqconfig;
  }

  configAxios(): AxiosInstance {
    const conf = this.configRequest();
    return axios.create(conf);
  }

  async getCredentials(): Promise<Credentials> {
    if (this.credentials !== undefined) {
      return this.credentials;
    }

    this.log.info(`Logging in as ${this.user}`);

    if (this.user === undefined || this.password === undefined) {
      return Promise.reject(new Error('Openreview API: user or password not defined'));
    }
    const creds = await this.postLogin();

    this.log.info(`Logged in as ${creds.user.id}`);

    this.credentials = creds;
    return creds;
  }

  async postLogin(): Promise<Credentials> {
    return this.configAxios()
      .post('/login', { id: this.user, password: this.password })
      .then(r => r.data)
      .catch(e => displayRestError(this.log, e));
  }

  async apiGET<R>(url: string, query: Record<string, string | number>): Promise<R | undefined> {
    const run = () =>
      this.configAxios()
        .get(url, { params: query })
        .then(response => response.data);

    return this.apiAttempt(run, 1);
  }

  async apiPOST<PD extends object, R>(url: string, postData: PD): Promise<R | undefined> {
    const run = () =>
      this.configAxios()
        .post(url, postData)
        .then(response => response.data);

    return this.apiAttempt(run, 1);
  }

  async apiAttempt<R>(apiCall: () => Promise<R>, retries: number): Promise<R | undefined> {
    if (retries === 0) return undefined;

    await this.getCredentials();
    return apiCall()
      .catch(error => {
        displayRestError(this.log, error);
        this.credentials = undefined;
        this.log.warn(`API Error ${error}: retries=${retries} `);
        return this.apiAttempt(apiCall, retries - 1);
      });
  }

}


function isAxiosError(error: any): error is AxiosError {
  return error['isAxiosError'] !== undefined && error['isAxiosError'];
}

export function displayRestError(log: Logger, error: ErrorTypes): void {
  if (isAxiosError(error)) {
    const { request, response, message } = error;
    const errorList: string[] = []
    errorList.push(`HTTP Request Error: ${message}`);
    if (request) {
      const req: ClientRequest = request;
      // const headers = req.getHeaders()
      // const headerFmt = `${headers}`; // prettyFormat(headers)
      // const headerLines = headerFmt.split('\n');
      const path = req.path;
      errorList.push(`Request: path=${path}`);
    }
    if (response) {
      const { status, statusText } = response;
      errorList.push(`Response: ${message}: response=${status}/${statusText}`);
    }
    putStrLn(errorList.join('\n'));
    return;
  }

  console.log(error);
}
