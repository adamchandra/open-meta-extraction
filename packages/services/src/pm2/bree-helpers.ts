import { getServiceLogger } from '@watr/commonlib';
import Bree from 'bree';
import Graceful from '@ladjs/graceful';
import path from 'path';
import _ from 'lodash';
import { Logger } from 'winston';

export interface BreeLogger extends Record<string, unknown> {
  underlying: Logger;
  info(msg: string, ...meta: any[]): void;
  warn(msg: string, ...meta: any[]): void;
  debug(msg: string, ...meta: any[]): void;
  error(msg: string, ...meta: any[]): void;
}

export function getBreeLogger(name: string): BreeLogger {
  const breeLogger: BreeLogger = {
    underlying: getServiceLogger(name),
    info(msg: string, ...meta: any[]) {
      this.underlying.info(msg, ...meta);
    },
    debug(msg: string, ...meta: any[]) {
      this.underlying.debug(msg, ...meta);
    },
    warn(msg: string, ...meta: any[]) {
      this.underlying.warn(msg, ...meta);
    },
    error(msg: string, ...meta: any[]) {
      this.underlying.error(msg, ...meta);
    },
  };
  return breeLogger;
}

export function jobDef(
  jobName: string,
  jobArgv: string[],
  interval: string,
  nameModifier?: string
): Bree.JobOptions {
  let jobDisplayName = _.upperFirst(_.camelCase(jobName));
  if (nameModifier) {
    // Job names  must be  unique within Bree,  so append a  modifier if  we are
    // going to run multiple jobs of the same type
    jobDisplayName += `:${nameModifier}`
  }
  const job: Bree.JobOptions = {
    name: jobName,
    interval,
    worker: {
      argv: [jobName, ...jobArgv],
    },
    outputWorkerMetadata: false,
  };
  return job;
}

// /**
//  * Run a cli job using the Bree scheduler
//  */
// export function cliJob(
//   cliApp: string,
//   cliArgs: string[],
//   interval: string,
//   nameModifier?: string
// ): Bree.JobOptions {
//   const baseName = _.upperFirst(_.camelCase(cliApp));
//   const qualifiedName = nameModifier ? `${baseName}:${nameModifier}` : baseName;
//   const jobPath = path.join(__dirname, 'jobs', 'run-cli.js');

//   const job: Bree.JobOptions = {
//     name: qualifiedName,
//     path: jobPath,
//     interval,
//     worker: {
//       argv: [cliApp, ...cliArgs],
//     },
//     outputWorkerMetadata: false,
//   };
//   return job;
// }


export function createBreeScheduler(jobs: Bree.JobOptions[]): Bree {
  const jobRoot = path.join(__dirname, 'jobs');
  const log = getBreeLogger('Bree');

  const bree = new Bree({
    root: jobRoot,
    removeCompleted: false,
    logger: log,
    jobs,

    errorHandler: (error, workerMetadata) => {
      if (workerMetadata.threadId) {
        log.error(`There was an error while running a worker ${workerMetadata.name} with thread ID: ${workerMetadata.threadId}`);
      } else {
        log.error(`There was an error while running a worker ${workerMetadata.name}`);
      }

      log.error(error);
    },
    workerMessageHandler: (messageInfo: any) => {
      const { message } = messageInfo;
      switch (message) {
        default:
          log.info(`jobmsg> ${message}`);
      }
    }
  });

  const graceful = new Graceful({ brees: [bree] });
  graceful.listen();

  bree.on('worker created', (name) => {
    log.debug(`worker ${name} created`);
  });

  bree.on('worker deleted', (name) => {
    log.debug(`worker ${name} deleted`);
  });

  bree.start();
  log.info('Bree Scheduler Started');
  return bree;
}

