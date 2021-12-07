import { spawn } from 'child_process';
import { promisifyOn, streamifyProcess } from '@watr/commonlib';

export async function runFileCmd(
  infile: string
): Promise<string> {
  const proc = spawn('file', ['-b', '-i', '--no-buffer', infile]);

  const { outStream, completePromise } = streamifyProcess(proc);
  const onDataPromise = promisifyOn<string>('data', outStream);

  return completePromise.then(() => {
    return onDataPromise;
  });
}

