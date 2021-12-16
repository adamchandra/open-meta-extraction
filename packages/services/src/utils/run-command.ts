import _ from 'lodash';

import { spawn } from 'child_process';
import { streamPump, TransformProcess, streamifyProcess } from '@watr/commonlib';

export type StdErrAndStdOutLines = [string[], string[], number];

export function runCmd(cmd: string, args: string[]): TransformProcess {
  const proc = spawn(cmd, args);
  return streamifyProcess(proc);
}


export function bufferCmdOutput(cmdProcess: TransformProcess): Promise<StdErrAndStdOutLines> {
  const { outStream, errStream, completePromise } = cmdProcess;

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

export function runCmdBuffered(cmd: string, args: string[]): Promise<StdErrAndStdOutLines> {
  return bufferCmdOutput(runCmd(cmd, args));
}
