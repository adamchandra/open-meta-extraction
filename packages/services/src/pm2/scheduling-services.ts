import { arglib, getServiceLogger, putStrLn, setLogLabels } from '@watr/commonlib';
const { opt, config, registerCmd } = arglib;
import workerThreads from 'worker_threads';

import path from 'path';

import _ from 'lodash';

import Bree from 'bree';
import Graceful from '@ladjs/graceful';

interface BreeLogger extends Record<string, unknown>{
  info(msg: string, ...meta: any[]): void;
  warn(msg: string, ...meta: any[]): void;
  error(msg: string, ...meta: any[]): void;
}

function getBreeLogger(name: string): BreeLogger {
  const log = getServiceLogger(name)

  // const { threadId, isMainThread } = workerThreads;
  const breeLogger: BreeLogger = {
    info(msg: string, ...meta: any[]) {
      // const threadStr = isMainThread? 't#main' : `t#${threadId}`;
      // const lbl = threadStr;
      // setLogLabels(log, lbl);
      log.info(msg, ...meta);
    },
    warn(msg: string, ...meta: any[]) {
      log.warn(msg, ...meta);
    },
    error(msg: string, ...meta: any[]) {
      log.error(msg, ...meta);
    },
  };
  return breeLogger;
}

export function registerCommands(yargv: arglib.YArgsT) {
  registerCmd(
    yargv,
    'scheduler',
    'Scheduling setup',
    config(
      opt.ion('dry-run: echo actions without performing them', {
        type: 'boolean',
        required: false,
        default: false
      }),
    )
  )(async (args: any) => {
    const log = getServiceLogger("Scheduler")
    log.info('Starting Scheduler')

    const breeLogger = getBreeLogger("Bree");
    const jobLogger = getBreeLogger("Job");

    // Send status email once per day (on restart)
    // Restart extractor at least once per day
    // Watch for file/sentinel change to restart
    // Monitor extraction rate and warn when too low

    const jobRoot = path.join(__dirname, 'jobs')

    const bree = new Bree({
      root: jobRoot,
      removeCompleted: true,

      logger: breeLogger,

      jobs: [
        {
          name: 'run-cli',
          interval: 2000,
          worker: {
            argv: ['echo', '--message', 'Hello from Bree!'],
          },
          outputWorkerMetadata: false,
        },
      ],
      errorHandler: (error, workerMetadata) => {
        // workerMetadata will be populated with extended worker information only if
        // Bree instance is initialized with parameter `workerMetadata: true`
        if (workerMetadata.threadId) {
          // logger.info(`There was an error while running a worker ${workerMetadata.name} with thread ID: ${workerMetadata.threadId}`)
          putStrLn(`There was an error while running a worker ${workerMetadata.name} with thread ID: ${workerMetadata.threadId}`)
        } else {
          putStrLn(`There was an error while running a worker ${workerMetadata.name}`)
        }

        putStrLn(error);
      },
      workerMessageHandler: (messageInfo: any) => {
        const { message } = messageInfo;
        putStrLn(message)
      }
    });

    const graceful = new Graceful({ brees: [bree] });
    graceful.listen();

    bree.on('worker created', (name) => {
      breeLogger.info(`worker ${name} created`);
    });

    bree.on('worker deleted', (name) => {
      breeLogger.info(`worker ${name} deleted`);
    });

    bree.start();
    log.info('Bree Scheduler Started');

  });

}
