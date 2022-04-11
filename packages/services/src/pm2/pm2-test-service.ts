import { arglib, delay, putStrLn } from '@watr/commonlib';
const { opt, config, registerCmd } = arglib;

import _ from 'lodash';
import { asyncDoUntil } from '~/util/async-plus';

export function registerCmds(yargv: arglib.YArgsT) {

  registerCmd(
    yargv,
    'echo',
    'Service just for testing...',
    config(
      opt.ion('message: the message to echo', {
        type: 'string',
        demandOption: true
      }),
      opt.ion('interval: repeat every [interval] ms', {
        type: 'number',
        demandOption: false
      }),
    )
  )(async (args: any) => {
    const { message, interval } = args;
    let counter = 0;

    if (interval && typeof interval === 'number') {
      async function loopFn(): Promise<boolean> {
        putStrLn(`${counter}: ${message}`);
        counter += 1;
        await delay(interval)
        return false;
      }

      async function testFn(loopResults: boolean): Promise<boolean> {
        return loopResults;
      }

      await asyncDoUntil(loopFn, testFn);

      return;
    }

    putStrLn(`once: ${message}\n`);

  });

}
