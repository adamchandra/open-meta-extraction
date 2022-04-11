import { getServiceLogger } from '@watr/commonlib';
import pm2 from 'pm2';
import workerThreads, { parentPort } from 'worker_threads';
import process from 'process';
import path from 'path';

// export const cron_1amDaily = '0 0 1 ? * * *';
// export const seconds = (ms: number) => ms * 1000;

export function pm2List(): Promise<pm2.ProcessDescription[]> {
  return new Promise<pm2.ProcessDescription[]>((resolve, reject) => {
    pm2.list(function (error: Error, ls: pm2.ProcessDescription[]) {
      if (error) {
        reject(error);
        return;
      }
      resolve(ls);
    });
  });
}

export async function pm2Restart(proc: string | number): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    pm2.restart(proc, function (error: Error) {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
}

export const pm2x = {
  //   connect: promisify(pm2.connect),
  //   disconnect: promisify(pm2.disconnect),
  //   start: promisify(pm2.start),
  //   stop: promisify(pm2.stop),
  //   reload: promisify(pm2.reload),
  restart: pm2Restart,
  list: pm2List
  //   delete: promisify(pm2.delete),
  //   describe: promisify(pm2.describe),
};



function exitJob() {
  const { parentPort } = workerThreads;
  if (parentPort) parentPort.postMessage('done');
  else process.exit(0);
}

function getWorkerData(): any {
  const { workerData } = workerThreads;
  return workerData;
}

type JobLogger = (msg: string) => void;

function getJobLogger(jobFilename: string): JobLogger {
  const infoLogger = getServiceLogger(`job:${jobFilename}`).info

  function jobLogger(msg: string): void {
    const { threadId, isMainThread } = workerThreads;
    const threadStr = isMainThread? 't#main' : `t#${threadId}`;
    if (parentPort !== null) {
      parentPort.postMessage(`[job:${jobFilename}:${threadStr}] - ${msg}`);
      return;
    }
    infoLogger(msg);
  }

  return jobLogger;
}

export async function runJob(
  jobFilename: string,
  jobFunc: (logger: JobLogger, workerData: any) => void | Promise<void>
): Promise<void> {
  const baseName = path.basename(jobFilename);
  const baseNoExt = baseName.substring(0, baseName.length - 3);
  const log: JobLogger = getJobLogger(baseNoExt)
  log('Job Started');

  const workerData = getWorkerData();
  // const wdPretty = prettyFormat({ workerData, workerThreads})

  // log(`\n${wdPretty}\n`);

  await Promise.resolve(jobFunc(log, workerData))

  log('Job Complete, exiting');
  exitJob()
}
