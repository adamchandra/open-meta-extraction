import _ from 'lodash';

import { spawn } from 'child_process';
import { streamPump, TransformProcess, streamifyProcess } from '@watr/commonlib';

export function runTidyCmd(
  configFile: string,
  infile: string
): TransformProcess {
  const proc = spawn('tidy', ['-config', configFile, infile]);

  return streamifyProcess(proc);
}

export type StdErrAndStdOutLines = [string[], string[], number];

export function runTidyCmdBuffered(
  configFile: string,
  infile: string
): Promise<StdErrAndStdOutLines> {
  const { outStream, errStream, completePromise } = runTidyCmd(configFile, infile);

  const tidyOutput = streamPump
    .createPump()
    .viaStream<string>(outStream)
    .gather()
    .toPromise()
    .then(ss => ss || []);

  const tidyErrs = streamPump
    .createPump()
    .viaStream<string>(errStream)
    .gather()
    .toPromise()
    .then(ss => ss || []);

  return Promise.all([tidyErrs, tidyOutput, completePromise]);
}

