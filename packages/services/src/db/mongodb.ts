import { getServiceLogger, initConfig, isTestingEnv, putStrLn } from '@watr/commonlib';
import mongoose from 'mongoose';

import { createCollections } from '~/db/schemas';
import { Mongoose } from 'mongoose';

const log = getServiceLogger('MongoDB');

export function mongoConnectionString(): string {
  const config = initConfig();
  const ConnectionURL = config.get('mongodb:connectionUrl');
  const MongoDBName = config.get('mongodb:dbName');
  let connectUrl = `${ConnectionURL}/${MongoDBName}`;
  return connectUrl;
}

export async function connectToMongoDB(): Promise<Mongoose> {
  const connstr = mongoConnectionString();
  log.info(`connecting to ${connstr}`);
  return mongoose.connect(connstr, { connectTimeoutMS: 5000 });
}

export async function resetMongoDB(): Promise<void> {
  const config = initConfig();
  const MongoDBName = config.get('mongodb:dbName');
  log.info(`dropping MongoDB ${MongoDBName}`);
  await mongoose.connection.dropDatabase();
  log.info('createCollections..');
  await createCollections();
}


interface CurrentTimeOpt {
  currentTime(): Date;
}

export function createCurrentTimeOpt(): CurrentTimeOpt {
  if (!isTestingEnv()) {
    const defaultOpt: CurrentTimeOpt = {
      currentTime: () => new Date()
    };
    return defaultOpt;
  }
  log.info('Using MongoDB Mock Timestamps');
  const currentFakeDate = new Date();
  currentFakeDate.setDate(currentFakeDate.getDate() - 14);
  const mockedOpts: CurrentTimeOpt = {
    currentTime: () => {
      const currDate = new Date(currentFakeDate);
      const rando = Math.floor(Math.random() * 10) + 1;
      const jitter = rando % 4;
      currentFakeDate.setHours(currentFakeDate.getHours() + jitter);
      return currDate;
    }
  };
  return mockedOpts;
}

type RunWithMongo = (m: Mongoose) => Promise<void>;
export async function withMongo(
  run: RunWithMongo,
  emptyDB: boolean
): Promise<void> {

  const config = initConfig();
  const MongoDBName = config.get('mongodb:dbName');
  const mongoose = await connectToMongoDB();
  log.info('mongo connected...')
  if (emptyDB) {
    if (! /.+test.*/.test(MongoDBName)) {
      throw new Error(`Tried to reset mongodb ${MongoDBName}; can only reset a db w/name matching /test/`);
    }
    log.info('mongo resetting...')
    await resetMongoDB();
  }
  try {
    log.info('mongo running client...')
    await run(mongoose);
  } finally {
    log.info('mongo closing...')
    await mongoose.connection.close();
  }
}
