import _ from 'lodash';

import { withMongo } from '~/db/mongodb';
import { respondWith, withServer } from '@watr/spider';

export const withServerAndCleanMongo: typeof withServer = async (setup, run) => {
  return withMongo(async () => {
    return await withServer(
      (r) => {
        r.post('/login', respondWith({ token: 'fake-token', user: { id: '~TestUser;' } }));
        setup(r)
      },
      run
    );
  }, true);
};

