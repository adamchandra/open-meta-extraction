import _ from 'lodash';
import fs from 'fs-extra';
import path from 'path';

import yargs, { Argv, Arguments, Options, MiddlewareFunction, PositionalOptions, ParserConfigurationOptions } from 'yargs';
// import hideBin from 'yargs/helpers'

import { putStrLn } from '~/util/pretty-print';
import { AllLogLevels } from '~/util/basic-logging';



export const YArgs = yargs;
export type YargsInstance = typeof yargs;

export type YArgsT = yargs.Argv;

export type ArgvApp = (ya: Argv) => Argv;

export interface MiddlewareCallback {
  (argv: Arguments, yargs: YargsInstance):
    | Partial<Arguments>
    | Promise<Partial<Arguments>>;
}

export function config(...fs: ArgvApp[]): ArgvApp {
  return ya => _.reduce(fs, (acc, f) => f(acc), ya);
}

function resolveArgPath(argv: Arguments, pathkey: string): string | undefined {
  if (typeof argv[pathkey] !== 'string') {
    return;
  }

  let pathvalue = argv[pathkey] as string;

  if (!path.isAbsolute(pathvalue)) {
    const wd = argv.cwd;
    pathvalue = typeof wd === 'string' ? path.resolve(wd, pathvalue) : path.resolve(pathvalue);
  }
  pathvalue = path.normalize(pathvalue);
  const ccKey = _.camelCase(pathkey);

  argv[pathkey] = pathvalue;
  argv[ccKey] = pathvalue;

  return pathvalue;
}

export const setCwd = (ya: Argv): Argv => ya.option('cwd', {
  describe: 'set working directory',
  normalize: true,
  type: 'string',
  requiresArg: true,
});

interface OptNameDesc {
  name: string;
  desc: string;
}

function splitArgDesc(argDesc: string, defaultDesc: string): OptNameDesc {
  if (argDesc.includes(':')) {
    const [name, desc] = argDesc.split(':', 2).map(o => o.trim());
    return { name, desc };
  }
  return { name: argDesc, desc: defaultDesc };
}

const optAndDesc = (optAndDesc: string, ext?: Options) => (ya: Argv): Argv => {
  const { name, desc } = splitArgDesc(optAndDesc, '');

  const opts = ext || {};
  if (desc.length > 0) {
    opts.description = desc;
  }

  return ya.option(name, opts);
};

const positionalAndDesc = (optAndDesc: string, ext?: PositionalOptions) => (ya: Argv): Argv => {
  const { name, desc } = splitArgDesc(optAndDesc, '');

  const opts = ext || {};
  if (desc.length > 0) {
    opts.description = desc;
  }

  return ya.positional(name, opts);
};

const optFlag = (odesc: string, def?: boolean) => optAndDesc(odesc, {
  type: 'boolean',
  demandOption: def === undefined,
  default: def
});

const optNum = (odesc: string, def?: number) => optAndDesc(odesc, {
  type: 'number',
  demandOption: def === undefined,
  default: def
});

const optString = (odesc: string, def?: string) => optAndDesc(odesc, {
  type: 'string',
  demandOption: def === undefined,
  default: def
});

const optlogLevel = (def?: string) => optAndDesc('log-level: set logging level', {
  type: 'string',
  choices: AllLogLevels,
  demandOption: def === undefined,
  default: def
});

function updateErrorList(argv: Arguments, error: string) {
  _.update(argv, ['errors'], (prev: string[] | undefined | null) => {
    const newval = prev || [];
    return _.concat(newval, [error]);
  });
}

const existingPath = (pathAndDesc: string) => (ya: Argv) => {
  const { name, desc } = splitArgDesc(pathAndDesc, `directory ${pathAndDesc}`);

  ya.option(name, {
    describe: desc,
    type: 'string',
    demandOption: true,
    requiresArg: true,
  });

  const middleFunc: MiddlewareFunction = (argv: Arguments) => {
    const p = resolveArgPath(argv, name);
    if (p && fs.existsSync(p)) {
      return;
    }
    updateErrorList(argv, `--${name}: Path doesn't exist: ${p}`);
  };

  ya.middleware(middleFunc, /* applyBeforeValidation= */ true);

  return ya;
};

export const existingDir = (dirAndDesc: string): (ya: Argv) => Argv => {
  return existingPath(dirAndDesc);
};

export interface TimeInterval {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  milliseconds: number;
}


function useMiddleware(cb: MiddlewareCallback): ArgvApp {
  return (ya) => {
    const cb0 = cb as any;
    ya.middleware(cb0, /* applyBeforeValidation= */ true);
    return ya;
  }
}

export const timeInterval = (argAndDesc: string) => (ya: Argv) => {
  const { name, desc } = splitArgDesc(argAndDesc, `timeInterval ${argAndDesc}`);
  const helpMsg = `Sample format is: 3d+2h+5m+10s+23z
where units d/h/m/s/z = days/hours/minutes/seconds/milliseconds
All terms optional, may be in any order, repeated units are added together
`;
  function isValidTerm(t: string) {
    return /\d+[dhmsz]/.test(t);
  }

  const middleFunc: MiddlewareFunction = (argv: Arguments) => {
    const argValue = argv[name]
    if (typeof argValue !== 'string') {
      return;
    }
    const terms = argValue.split(/\+/);
    putStrLn(`foo: ${terms}`)
    const timeInterval: TimeInterval = {
      days: 0,
      hours: 0,
      minutes: 0,
      seconds: 0,
      milliseconds: 0,
    }

    terms.forEach((term) => {
      if (!isValidTerm(term)) {
        const msg = `timeInterval term '${term}' invalid in: ${argValue}`;
        updateErrorList(argv, msg);
        updateErrorList(argv, helpMsg);
      }
      const nums = parseInt(term.slice(0, term.length - 1));

      const kind = term.slice(term.length - 1);
      switch (kind) {
        case 'd':
          timeInterval.days = nums;
          break
        case 'h':
          timeInterval.hours = nums;
          break
        case 'm':
          timeInterval.minutes = nums;
          break
        case 's':
          timeInterval.seconds = nums;
          break
        case 'z':
          timeInterval.milliseconds = nums;
          break
      }
    });

    argv[name] = timeInterval;
  };

  ya.option(name, {
    describe: desc,
    type: 'string',
    demandOption: true,
    requiresArg: true,
  });

  ya.middleware(middleFunc, /* applyBeforeValidation= */ true);
  return ya;
};

export const existingFile = (fileAndDesc: string): (ya: Argv) => Argv => {
  return existingPath(fileAndDesc);
};

export const configFile = (ya: Argv): Argv => {
  ya.option('config', {
    describe: 'optional path to configuration file',
    type: 'string',
    requiresArg: true,
  });

  ya.middleware((argv: Arguments) => {
    if (typeof argv.config === 'string') {
      const configFile = resolveArgPath(argv, 'config');
      if (!configFile) {
        throw new Error('Non-existent config file specified');
      }
      // Set working directory to config file dir if not already set
      if (!argv.cwd) {
        argv.cwd = path.dirname(configFile);
      }
      const buf = fs.readFileSync(configFile);
      const conf = JSON.parse(buf.toString());
      const confKVs = _.toPairs(conf);
      _.each(confKVs, ([k, v]) => {
        argv[k] = v;
      });
      return;
    }
    return;
  }, /* applyBeforeValidation= */ true);

  return ya;
};


// TODO this causes a compiler crash!!!!
// export const setOptx = (ya: Argv) => {
//   return ya.option;
// };

export function registerCmd(
  useYargs: Argv,
  name: string,
  description: string,
  ...fs: ArgvApp[]
): (cb: (parsedArgs: any) => void | Promise<void>) => void {
  return (cb: (parsedArgs: any) => void | Promise<void>) => {
    useYargs.command(
      name, description, config(...fs), async (argv: any): Promise<void> => {
        if (_.isArray(argv.errors)) {
          const errors: string[] = argv.errors;
          const errstr = errors.join('\n');
          putStrLn(`Error running Command: ${errstr}`);
          return;
        }
        // const time1 = (new Date()).toLocaleTimeString();
        const res = await Promise.resolve(cb(argv));
        // const time2 = (new Date()).toLocaleTimeString();
        return res;
      }
    );
  };
}
export async function runRegisteredCmds(useYargs: Argv): Promise<void> {
  const res = useYargs
    .strictCommands()
    .demandCommand(1, 'You need at least one command before moving on')
    .help()
    .fail((err) => {
      console.log('RunCLI Error', err);
      useYargs.showHelp();
    })
    .argv;

  await Promise.resolve(res);
}
export const opt = {
  config: configFile,
  existingDir,
  existingFile,
  timeInterval,
  // obj: setOpt,
  dir: existingDir,
  file: existingFile,
  cwd: setCwd,
  ion: optAndDesc,
  flag: optFlag,
  num: optNum,
  str: optString,
  logLevel: optlogLevel,
  positional: positionalAndDesc,
  useMiddleware
};
