import _ from 'lodash';
import Redis from 'ioredis';
import { getServiceLogger } from '@watr/commonlib';

export const RedisConnectionEvents = [
  'ready',
  'close',
  'end',
  'error',
  'connect',
  'reconnecting'
];

export function newRedisClient(name: string, opts?: Redis.RedisOptions): Redis.Redis {
  const host = 'localhost';
  const allOpts = _.merge({}, { host }, opts);
  const client = new Redis(allOpts);
  installEventEchoing(client, name);
  return client;
}

function installEventEchoing(r: Redis.Redis, name: string) {
  const log = getServiceLogger(`${name}/redis`);
  _.each(RedisConnectionEvents, (e: string) => {
    r.on(e, () => log.debug(`event:${e}`));
  });
}
