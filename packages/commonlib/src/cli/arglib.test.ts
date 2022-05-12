import _ from 'lodash';
import { config, ArgvApp, registerCmd, YArgs } from '~/cli/arglib';
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

      // prettyPrint({ allargs });

      YArgs
        .demandCommand(1, 'You need at least one command before moving on')
        .fail((msg, err, _yargs) => {
          const errmsg = err ? `${err.name}: ${err.message}` : '';
          prettyPrint({ msg, errmsg });
          reject(msg);
        }).parse(allargs);
    });
  }

  test('should register multiple commands', async () => {
    const commandNames = _.map(_.range(3), (i) => `Cmd${i}`);
    const cmdsThatRan: string[] = [];

    _.each(commandNames, (cmdName) => {
      registerCmd(YArgs, cmdName, `run ${cmdName}`,)(() => {
        prettyPrint({ msg: `running ${cmdName}` })
        cmdsThatRan.push(cmdName);
      });
    });

    const runner = YArgs
      .demandCommand(1, 'You need at least one command before moving on')
      .fail((msg, err, _yargs) => {
        const errmsg = err ? `${err.name}: ${err.message}` : '';
        prettyPrint({ msg, errmsg });
      });

    _.each(commandNames, (cmdName) => {
      runner.parse(cmdName);
    });


    // expect(commandNames).toStrictEqual(cmdsThatRan);
  });


  test('should resolve file/directory args', () => {
    // const edir = opt.existingDir('corpus-root: root directory for corpus files');
    // edir(argv)
    // const result = await runCmd(
    //   '--cwd . --corpus-root df',
    //   opt.cwd,
    //   opt.existingDir('corpus-root: root directory for corpus files'),
    // ).catch(error => {
    //   prettyPrint({ caughtErr: error });
    // });

    // prettyPrint({ result });
  });
});
