import { initConfig, isTestingEnv, putStrLn } from '@watr/commonlib';
import mongoose from 'mongoose';

import { createCollections } from '~/db/schemas';
import { Mongoose } from 'mongoose';

export function mongoConnectionString(): string {
  const config = initConfig();
  const ConnectionURL = config.get('mongodb:connectionUrl');
  const MongoDBName = config.get('mongodb:dbName');
  let connectUrl = `${ConnectionURL}/${MongoDBName}`;
  return connectUrl;
}

export async function connectToMongoDB(): Promise<Mongoose> {
  const connstr = mongoConnectionString();
  putStrLn(`connecting to ${connstr}`);
  return mongoose.connect(connstr, { connectTimeoutMS: 5000 });
}

export async function resetMongoDB(): Promise<void> {
  const config = initConfig();
  const MongoDBName = config.get('mongodb:dbName');
  putStrLn(`dropping MongoDB ${MongoDBName}`);
  await mongoose.connection.dropDatabase();
  putStrLn('createCollections..');
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
  putStrLn('Using MongoDB Mock Timestamps');
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
  putStrLn('mongo connected...')
  if (emptyDB) {
    if (! /.+test.*/.test(MongoDBName)) {
      throw new Error(`Tried to reset mongodb ${MongoDBName}; can only reset a db w/name matching /test/`);
    }
    putStrLn('mongo resetting...')
    await resetMongoDB();
  }
  try {
    putStrLn('mongo running client...')
    await run(mongoose);
  } finally {
    putStrLn('mongo closing...')
    await mongoose.connection.close();
  }
}
