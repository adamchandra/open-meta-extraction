import _ from 'lodash';
import path from 'path';

import { throughFunc, } from '@watr/commonlib';
import { runFileCmd, runTidyCmd, runTidyCmdBuffered } from './shell-commands';
import { runPandocHtmlToMarkdown } from './shell-commands';

describe('run command-line utils', () => {
  const testDirPath = './test/resources/htmls';
  const configFile = './conf/tidy.cfg';

  it('should run Html5 Tidy to re-write htmls', async () => {
    const htmlFile = path.resolve(testDirPath, 'nospace.html');

    const { outStream, completePromise } = runTidyCmd(configFile, htmlFile);

    const lines: string[] = [];

    outStream
      .pipe(throughFunc(
        (line: string, _onerr?: (e: any) => void) => {
          lines.push(line);
        }))
      .on('data', () => {});

    await completePromise;

    const lines4 = lines.slice(0, 4);
    const padLeftLens = _.map(lines4, l => l.match(/^[ ]*/g)[0].length);
    expect(padLeftLens).toStrictEqual([0, 0, 4, 8]);

  });

  it('should get file types using file cmd', async () => {
    const htmlFile = path.resolve(testDirPath, 'nospace.html');

    const fileType = await runFileCmd(htmlFile);
    expect(fileType).toBe('text/html; charset=utf-8')
  });

  it('should handle process err output', async () => {
    const htmlFile = path.resolve(testDirPath, 'nospace.html');

    const [,out,] = await runTidyCmdBuffered(configFile, htmlFile);

    const lines4 = out.slice(0, 4);
    const padLeftLens = _.map(lines4, l => l.match(/^[ ]*/g)[0].length);
    expect(padLeftLens).toStrictEqual([0, 0, 4, 8]);
  });

  it('should convert html -> markdown', async () => {
    const htmlFile = path.resolve(testDirPath, 'neurips.response_body.html');
    const lines = await runPandocHtmlToMarkdown(htmlFile);

    expect(lines.length > 0).toBe(true);
  });
});
