import _ from 'lodash';

import { respondWith, withServer } from '@watr/spider';
import { withMongo } from '~/db/mongodb';

export const withServerAndCleanMongo: typeof withServer = async (setup, run) => {
  return withMongo(async () => {
    return withServer(
      (r) => {
        r.post('/login', respondWith({ token: 'fake-token', user: { id: '~TestUser;' } }));
        setup(r);
      },
      run
    );
  }, true);
};

