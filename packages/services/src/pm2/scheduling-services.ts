import {
  arglib, delay, getServiceLogger, initConfig, putStrLn,
  asyncEachSeries, asyncForever, prettyPrint
} from '@watr/commonlib';

import * as E from 'fp-ts/Either';

import _ from 'lodash';

import { Mongoose } from 'mongoose';
import { pm2x } from './pm2-helpers';
import { createBreeCLIJob, createBreeScheduler, createBreeJob } from './bree-helpers';

import { sigtraps } from '~/util/shutdown';
import { connectToMongoDB } from '~/db/mongodb';
import { createCollections } from '~/db/schemas';

import { parseSchedule } from '~/util/scheduler';

const { opt, config, registerCmd } = arglib;

export function registerCommands(yargv: arglib.YArgsT) {
  // TODO delete dead code
  //   registerCmd(
  //     yargv, 'pm2-restart', 'Notification/Restart scheduler'
  //   )(async () => {
  //     const log = getServiceLogger('PM2Restart');
  //     log.info('PM2 Restart');

  //     const skipRE = /(pm2.?restart|scheduler)/i;
  //     const appList = await pm2x.list();
  //     const appNames = appList.map(a => a.name || '').filter(n => n.length > 0);

  //     await asyncEachSeries(appNames, async (name) => {
  //       if (skipRE.test(name)) {
  //         return;
  //       }
  //       log.info(`stopping ${name}`);
  //       return pm2x.stop(name);
  //     });
  //     await asyncEachSeries(appNames, async (name) => {
  //       if (skipRE.test(name)) {
  //         return;
  //       }
  //       log.info(`restarting ${name}`);
  //       return pm2x.restart(name);
  //     });
  //   });

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
    const jobs = timers.map((t, i) => createBreeJob('echo', [`--message='scheduled for:  ${t}'`], t, `${i}`));

    createBreeScheduler(jobs);

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

    let mongoose: Mongoose | undefined;

    async function closeMongoose() {
      if (mongoose !== undefined) {
        log.info('Closing Mongoose..');
        await mongoose.connection.close()
          .catch((error) => {
            log.error(`Error stopping mongoos ${error}`);
          });
      }
    }

    async function stopAllPM2() {
      log.info('PM2 stop all..');
      await pm2x.stop('all')
        .catch(error => {
          log.error(`Error stopping ${error}`);
        });
    }

    async function startAllPM2() {
      try {
        log.info('PM2 restart all..');
        await pm2x.restart('all')
          .catch(error => {
            log.error(`Error starting ${error}`);
          });
      } catch (error) {
        log.error(`Error stopping ${error}`);
      }
    }

    async function die(msg: string) {
      log.error(`Halting. Reason: ${msg}`);
      process.exit(1);
    }

    log.info('Starting Preflight Check');
    const pm2Apps = await pm2x.list();
    const existingPM2AppNames = pm2Apps.map((app) => {
      const name = app.name || '<unnamed>';
      return { name };
    });
    prettyPrint({ existingPM2AppNames });

    try {
      initConfig();
    } catch (error: any) {
      await stopAllPM2();
      die(`No Config found; stopping pm2 apps: ${error}`);
    }
    log.info('Found config file');


    try {
      mongoose = await connectToMongoDB();
      if (mongoose === undefined) {
        await stopAllPM2();
        await closeMongoose();
        die('Could not connect to MongoDB');
      }
      await createCollections();
    } catch (error) {
      log.info(`Error with MongoDB: ${error}`);
      await closeMongoose();
      await stopAllPM2();
      die('Error connecting to MongoDB');
    }

    log.info('Ensured MongoDB is running');

    await closeMongoose();

    log.info('Everything looks good, deleting self..');
    pm2x.delete('PreflightCheck');
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
    const log = getServiceLogger('Scheduler');
    const maybeSchedule = parseSchedule(scheduleSpec);

    if (E.isLeft(maybeSchedule)) {
      log.info('Scheduling specification has errors:');
      maybeSchedule.left.forEach(msg => {
        putStrLn(msg);
      });
      return;
    }

    const { argv } = process;
    const argvCli = argv.slice(5);
    log.info(`Scheduling ${argvCli.join(' ')}`);
    const [cmd, ...remaining] = argvCli;

    const job = createBreeCLIJob(cmd, remaining, scheduleSpec);
    const bree = createBreeScheduler([job]);

    await sigtraps(async () => {
      log.info('Shutting down');
    });
  });
}
