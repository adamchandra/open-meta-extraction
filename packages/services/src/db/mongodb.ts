import { initConfig, isTestingEnv, putStrLn } from '@watr/commonlib';
import mongoose from 'mongoose';

import { Mongoose } from 'mongoose';

export function mongoConnectionString(): string {
    const config = initConfig();
    const ConnectionURL = config.get('mongodb:connectionUrl');
    const MongoDBName = config.get('mongodb:dbName');
    return `${ConnectionURL}/${MongoDBName}`;
}

export async function connectToMongoDB(): Promise<Mongoose> {
    const connstr = mongoConnectionString()
    putStrLn(`connecting to ${connstr}`)
    return mongoose.connect(connstr);
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
    putStrLn('Using MongoDB Mock Timestamps')
    const currentFakeDate = new Date()
    currentFakeDate.setDate(currentFakeDate.getDate() - 14)
    const mockedOpts: CurrentTimeOpt = {
        currentTime: () => {
            const currDate = new Date(currentFakeDate)
            const rando = Math.floor(Math.random() * 10) + 1
            const jitter = rando % 4;
            currentFakeDate.setHours(currentFakeDate.getHours() + jitter)
            return currDate;
        }
    };
    return mockedOpts;
}
