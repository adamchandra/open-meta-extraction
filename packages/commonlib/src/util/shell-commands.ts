import { runCmdBuffered } from './run-command';
import { bufferCmdOutput, runCmd, StdErrAndStdOutLines } from './run-command';
import { TransformProcess } from './stream-utils';

export async function runFileCmd(
  infile: string
): Promise<string> {
  const [,out,] = await runCmdBuffered('file', ['-b', '-i', '--no-buffer', infile]);
  return out[0];
}

export function runTidyCmd(
  configFile: string,
  infile: string
): TransformProcess {
  return runCmd('tidy', ['-config', configFile, infile]);
}

export function runTidyCmdBuffered(
  configFile: string,
  infile: string
): Promise<StdErrAndStdOutLines> {
  return bufferCmdOutput(runTidyCmd(configFile, infile));
}

export async function runPandocHtmlToMarkdown(
  infile: string
): Promise<string[]> {
  const [,out,] = await runCmdBuffered('pandoc', ['-f', 'html', '-t', 'markdown_mmd', infile]);
  return out;
}
