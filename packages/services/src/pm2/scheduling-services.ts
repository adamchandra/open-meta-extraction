import {
  arglib, delay, getServiceLogger, initConfig, putStrLn,
  asyncEachSeries, asyncForever
} from '@watr/commonlib';
const { opt, config, registerCmd } = arglib;

import _ from 'lodash';

import { pm2x } from './pm2-helpers';
import { cliJob, createBreeScheduler, jobDef } from './bree-helpers';

import { sigtraps } from '~/util/shutdown';

export function registerCommands(yargv: arglib.YArgsT) {
  registerCmd(
    yargv, 'pm2-restart', 'Notification/Restart scheduler'
  )(async () => {
    const log = getServiceLogger("PM2Restart")
    log.info('PM2 Restart');

    const skipRE = /(pm2.?restart|scheduler)/i;
    const appList = await pm2x.list();
    const appNames = appList.map(a => a.name || '').filter(n => n.length > 0)

    await asyncEachSeries(appNames, async (name) => {
      if (skipRE.test(name)) {
        return;
      }
      log.info(`stopping ${name}`)
      return pm2x.stop(name);
    });
    await asyncEachSeries(appNames, async (name) => {
      if (skipRE.test(name)) {
        return;
      }
      log.info(`restarting ${name}`)
      return pm2x.restart(name);
    });

  })

  registerCmd(
    yargv, 'test-scheduler', 'Testing app for scheduler'
  )(async () => {
    const log = getServiceLogger("Scheduler")
    log.info('Testing Scheduler');
    const timers = [
      'every 4 sec',
      'after 2 sec',
    ];

    const jobs = timers.map((t, i) => cliJob('echo', [`--message='scheduled for:  ${t}'`], t, `${i}`));

    createBreeScheduler(jobs);

    await sigtraps(async () => {
      log.info('Shutting down');
    });
  });

  registerCmd(
    yargv, 'scheduler', 'Notification/Restart scheduler'
  )(async () => {
    const log = getServiceLogger("Scheduler")
    log.info('Starting Scheduler')

    // Send status email once per day (on restart)
    const emailJob = jobDef('send-email', [], 'every 12 hours')
    // Restart extractor at least once per day
    const restartJob = cliJob('pm2-restart', [], 'every 4 hours')
    // Watch for file/sentinel change to restart
    // Monitor extraction rate and warn when too low

    createBreeScheduler([restartJob, emailJob]);

    await sigtraps(async () => {
      log.info('Shutting down');
    });
  });

  registerCmd(
    yargv, 'echo', 'Echo message to stdout, once or repeating', config(
      opt.ion('message: the message to echo', {
        type: 'string',
        demandOption: true
      }),
      opt.ion('interval: repeat every [interval] ms', {
        type: 'number',
        demandOption: false
      }),
    ))(async (args: any) => {
      const { message, interval } = args;

      if (interval && typeof interval === 'number') {
        let counter = 0;
        await asyncForever(async () => {
          putStrLn(`${counter}: ${message}`);
          counter += 1;
          await delay(interval);
        });
      }

      putStrLn(`once: ${message}`);
    });

  registerCmd(
    yargv, 'preflight-check', 'Run checks and stop pm2 apps if everything looks okay'
  )(async () => {
    const log = getServiceLogger("PreflightCheck")
    log.info('Starting Preflight Check')

    try {
      initConfig();
      log.info('Found Config')
      return;
    } catch (error) {
      log.error('No Config; stopping pm2 apps');
    }
    try {
      log.info('Stopping..');
      await pm2x.stop('all');
    } catch (error) {
      log.error(`Error stopping ${error}`);
    }
  });
}
