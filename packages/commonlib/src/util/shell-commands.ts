import _ from 'lodash';
import { runCmdBuffered, bufferCmdOutput, runCmd, StdErrAndStdOutLines } from './run-command';
import { TransformProcess } from './stream-utils';

export async function runFileCmd(
  infile: string
): Promise<string> {
  const [, out,] = await runCmdBuffered('file', ['-b', '-i', '--no-buffer', infile]);
  return out[0];
}

//// Complete option list at
////   http://api.html-tidy.org/tidy/quickref_5.6.0.html#show-info
function tidyOptions(addArgs: string[]) {
  const stdopts = [
    'clean: no',
    'custom-tags: blocklevel',
    'drop-empty-elements: no',
    'drop-empty-paras: no',
    'force-output: yes',
    'indent-cdata: yes',
    'indent-spaces: 4',
    'indent: yes',
    'join-styles: no',
    'markup: yes',
    'merge-divs: no',
    'merge-spans: no',
    'output-xhtml: yes',
    'tab-size: 4',
    'tidy-mark: no',
    'wrap-asp: no',
    'wrap-attributes: no',
    'wrap-jste: no',
    'wrap-php: no',
    'wrap-script-literals: no',
    'wrap-sections: no',
    'wrap: 0',
  ];
  const stdArgs = _.flatMap(stdopts, opt => {
    const [name, val] = opt.split(/:/);
    return [`--${name.trim()}`, val.trim()];
  });

  return _.concat(stdArgs, addArgs);
}

export function runTidyCmd(
  infile: string
): TransformProcess {
  return runCmd('tidy', tidyOptions([infile]));
}

export function runTidyCmdBuffered(
  infile: string
): Promise<StdErrAndStdOutLines> {
  return bufferCmdOutput(runTidyCmd(infile));
}

export async function runPandocHtmlToMarkdown(
  infile: string
): Promise<string[]> {
  const [, out,] = await runCmdBuffered('pandoc', ['-f', 'html', '-t', 'markdown_mmd', infile]);
  return out;
}
