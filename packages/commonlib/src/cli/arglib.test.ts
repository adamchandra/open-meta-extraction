//
// import 'chai';

import _ from 'lodash';
// import yargs from 'yargs';
import { config, opt, ArgvApp, registerCmd, YArgs } from '~/cli/arglib';
import { prettyPrint } from '~/util/pretty-print';

describe('Arglib tests', () => {
  beforeEach(() => {
    // yargs.reset()
  });

  async function runCmd(args: string, ...fs: ArgvApp[]): Promise<Record<string, unknown>> {
    return new Promise((resolve, reject) => {
      YArgs.command(
        'testcmd', 'desc', config(...fs), (argv: any) => resolve(argv)
      );
      const argtokens = args.split(' ');
      const allargs = _.concat(['testcmd'], argtokens);
      prettyPrint({ allargs });

      YArgs
        .demandCommand(1, 'You need at least one command before moving on')
        .fail((msg, err, _yargs) => {
          const errmsg = err ? `${err.name}: ${err.message}` : '';
          prettyPrint({ msg, errmsg });
          reject(msg);
        }).parse(allargs);
    });
  }

  test('should properly print out argument errors', (done) => {
    done();
  });

  test('should register multiple commands', () => {
    registerCmd(
      YArgs,
      'extract-abstracts',
      'run the abstract field extractors over htmls in corpus',
      config(
        opt.cwd,
        opt.existingDir('corpus-root: root directory for corpus files'),
        opt.ion('overwrite: force overwrite of existing files', { boolean: false })
      )
    )((args: any) => {
      prettyPrint({ msg: 'success!', args });
    });

    const args1 = 'extract-abstracts --cwd . --corpus-root a/b/c --overwrite'.split(' ');
    // const args1b = 'extract-abstracts --cwd . --corpus-root . --overwrite'.split(' ');

    registerCmd(
      YArgs,
      'c1',
      'run c1',
      opt.existingDir('dir: dir 0'),
    )((args: any) => {
      prettyPrint({ 'running cmd': args });
    });
    // const args2 = 'c1 --dir non-existent'.split(' ');

    YArgs
      .demandCommand(1, 'You need at least one command before moving on')
      .fail((msg, err, _yargs) => {
        const errmsg = err ? `${err.name}: ${err.message}` : '';
        prettyPrint({ msg, errmsg });
      }).parse(args1);
  });


  test('should resolve file/directory args', async () => {
    const result = await runCmd(
      '--cwd . --corpus-root df',
      opt.cwd,
      opt.existingDir('corpus-root: root directory for corpus files'),
    ).catch(error => {
      prettyPrint({ caughtErr: error });
    });

    prettyPrint({ result });
  });
});
