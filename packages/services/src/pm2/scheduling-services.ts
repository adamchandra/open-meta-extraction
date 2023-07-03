import {
  arglib, delay, getServiceLogger, initConfig, putStrLn,
  asyncEachSeries, asyncForever, prettyPrint
} from '@watr/commonlib';

import * as E from 'fp-ts/Either';
const { opt, config, registerCmd } = arglib;

import _ from 'lodash';

import { pm2x } from './pm2-helpers';
import { createBreeCLIJob, createBreeScheduler, jobDef } from './bree-helpers';

import { sigtraps } from '~/util/shutdown';
import { Mongoose } from 'mongoose';
import { connectToMongoDB } from '~/db/mongodb';
import { createCollections } from '~/db/schemas';

import later from '@breejs/later'
import { parseSchedule } from '~/util/scheduler';

export function registerCommands(yargv: arglib.YArgsT) {
  registerCmd(
    yargv, 'pm2-restart', 'Notification/Restart scheduler'
  )(async () => {
    const log = getServiceLogger('PM2Restart');
    log.info('PM2 Restart');

    const skipRE = /(pm2.?restart|scheduler)/i;
    const appList = await pm2x.list();
    const appNames = appList.map(a => a.name || '').filter(n => n.length > 0);

    await asyncEachSeries(appNames, async (name) => {
      if (skipRE.test(name)) {
        return;
      }
      log.info(`stopping ${name}`);
      return pm2x.stop(name);
    });
    await asyncEachSeries(appNames, async (name) => {
      if (skipRE.test(name)) {
        return;
      }
      log.info(`restarting ${name}`);
      return pm2x.restart(name);
    });
  });

  registerCmd(
    yargv, 'test-scheduler', 'Testing app for scheduler'
  )(async () => {
    const log = getServiceLogger('Scheduler');
    log.info('Testing Scheduler');
    const timers = [
      'every 4 sec',
      'after 2 sec',
    ];

    // const jobs = timers.map((t, i) => cliJob('echo', [`--message='scheduled for:  ${t}'`], t, `${i}`));
    const jobs = timers.map((t, i) => jobDef('echo', [`--message='scheduled for:  ${t}'`], t, `${i}`));

    createBreeScheduler(jobs);

    await sigtraps(async () => {
      log.info('Shutting down');
    });
  });

  registerCmd(
    yargv, 'scheduler', 'Notification/Restart scheduler'
  )(async () => {
    const log = getServiceLogger('Scheduler');
    log.info('Starting Scheduler');

    // Send status email once per day (on restart)
    const emailJob = jobDef('send-email', [], 'every 12 hours');
    // Restart extractor at least once per day
    const restartJob = jobDef('pm2-restart', [], 'every 24 hours');
    // Monitor extraction rate and warn when too low

    createBreeScheduler([restartJob, emailJob]);

    await sigtraps(async () => {
      log.info('Shutting down');
    });
  });

  registerCmd(
    yargv, 'echo', 'Echo message to stdout', config(
      opt.str('message: the message to echo'),
    ))(async (args: any) => {
      const { message } = args;
      const log = getServiceLogger('Echo');
      putStrLn(`echo> ${message}`);
      log.info(`log/echo> ${message}`);
    });

  registerCmd(
    yargv,
    'preflight-check',
    'Run sanity checks at startup and halt pm2 apps if anything looks wrong',
    config()
  )(async () => {
    const log = getServiceLogger('PreflightCheck');
    log.info('Starting Preflight Check');

    let mongoose: Mongoose | undefined = undefined;
    try {
      initConfig();

      mongoose = await connectToMongoDB();
      if (mongoose === undefined) {
        log.error('Could not connect to MongoDB');
      }
      await createCollections();

      log.info('Found Config');

      return;
    } catch (error) {
      log.error('No Config; stopping pm2 apps');
    }

    if (mongoose !== undefined) {
      await mongoose.connection.close();
    }

    try {
      log.info('Stopping..');
      await pm2x.stop('all');
    } catch (error) {
      log.error(`Error stopping ${error}`);
    }

  });

  registerCmd(
    yargv,
    'schedule <scheduleSpec>',
    'Run a Command-line app on a schedule',
    config(
      opt.positional('scheduleSpec: specify the schedule for running command', {
        type: 'string',
      }),
    )
  )(async (args: any) => {
    const { scheduleSpec } = args;
    const maybeSchedule = parseSchedule(scheduleSpec);
    if (E.isLeft(maybeSchedule)) {
      maybeSchedule.left.forEach(msg => {
        putStrLn(msg)
      })
      return;
    }
    const scheduleData = maybeSchedule.right;

    const log = getServiceLogger('Scheduler');

    const argv = process.argv;
    const argvCli = argv.slice(5);
    prettyPrint({ argv, argvCli })
    log.info(`Running ${argvCli.join(' ')}`);
    const [cmd, ...remaining] = argvCli;

    const job = createBreeCLIJob(cmd, remaining, scheduleSpec);
    const bree = createBreeScheduler([job]);

    await sigtraps(async () => {
      log.info('Shutting down');
    });
  });
}
