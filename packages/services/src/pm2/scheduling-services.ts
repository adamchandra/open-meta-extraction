import { arglib, delay, getServiceLogger, putStrLn } from '@watr/commonlib';
const { opt, config, registerCmd } = arglib;

import path from 'path';

import _ from 'lodash';
import { asyncDoUntil } from '~/util/async-plus';
import { pm2x } from './eco-helpers';

import Bree from 'bree';
import Graceful from '@ladjs/graceful';
import { CliPath } from '~/cli';

export function registerCommands(yargv: arglib.YArgsT) {
  registerCmd(
    yargv,
    'scheduler',
    'Scheduling setup',
    config(
    )
  )(async (args: any) => {
    const log = getServiceLogger("Scheduler")
    log.info('Starting Scheduler')

    // Send status email once per day (on restart)
    // Restart extractor at least once per day
    // Watch for file/sentinel change to restart

    log.info(`Job path is ${CliPath}`);
    const srcDir = path.join(CliPath, '..')

    const bree = new Bree({
      root: srcDir,
      jobs: [
        {
          name: 'echo',
          path: './cli/index.js',
          interval: 2000,
          // cron: '15 10 ? * *',
          worker: {
            argv: ['echo', '--message', 'Hello from Bree!']
          }
        },
      ]
    });

    // handle graceful reloads, pm2 support, and events like SIGHUP, SIGINT, etc.
    const graceful = new Graceful({ brees: [bree] });
    graceful.listen();

    // start all jobs (this is the equivalent of reloading a crontab):
    bree.start();
    log.info('Bree Scheduler Started');
  });

  registerCmd(
    yargv,
    'pm2-sitter',
    'pm2 control, watch/restart, and monitoring app',
    config(
      opt.ion('watch: file to watch that will trigger restart', {
        type: 'string',
        demandOption: true
      }),
    )
  )(async (args: any) => {
    const { watch } = args;
    const log = getServiceLogger("PM2Sitter")

    putStrLn(`Started PM2Sitter watch = ${watch}`);
    // Send status email once per day (on restart)
    // Restart extractor at least once per day
    // Watch for file/sentinel change to restart

    const bree = new Bree({
      // logger: log

      jobs: [
        {
          name: 'cli',
          path: './dist/src/cli/index.js',
          cron: '15 10 ? * *',
          worker: {
            argv: []
          }
        },

      ]
    });

    // handle graceful reloads, pm2 support, and events like SIGHUP, SIGINT, etc.
    const graceful = new Graceful({ brees: [bree] });
    graceful.listen();

    // start all jobs (this is the equivalent of reloading a crontab):
    bree.start();

    let counter = 0;
    async function loopFn(): Promise<boolean> {
      putStrLn(`PM2Sitter: ping ${counter}..`);
      counter += 1;
      await delay(3000)

      const ls = await pm2x.list();

      ls.forEach(desc => {
        const { name, pid } = desc;
        console.log(`list(cb)> ${name}, pid=${pid}`)
      });

      return false;
    }

    async function testFn(loopResults: boolean): Promise<boolean> {
      return loopResults;
    }

    await asyncDoUntil(loopFn, testFn);

  });
}
