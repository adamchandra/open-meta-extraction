import _ from 'lodash';
import path from 'path';
import fs from 'fs-extra';
import { updateCorpusJsonFile, readCorpusJsonFile } from './corpus-file-walkers';

export function initTestCorpusDirs(scratchDir: string): { corpusRoot: string, corpusPath: string } {
  if (fs.existsSync(scratchDir)) {
    fs.removeSync(scratchDir);
  }
  const corpusRoot = 'corpus-root.d';
  const corpusPath = path.join(scratchDir, corpusRoot);

  fs.mkdirpSync(corpusPath);
  const spiderInputCSV = path.join(scratchDir, 'input-recs.csv');
  fs.writeFileSync(spiderInputCSV, `
Y15,dblp.org/journals/LOGCOM/2012,Title: Adv. in Cognitive Science.,http://localhost:9000/htmls/page0.html
Y35,dblp.org/journals/LOGCOM/2014,Title: Some Third Title,http://localhost:9000/htmls/page1.html
Y25,dblp.org/journals/LOGCOM/2013,Title: Some Other Title,http://localhost:9000/htmls/page2.html
`);

  return {
    corpusRoot,
    corpusPath,
  };
}

describe('Corpus filesystem access utilities', () => {
  const scratchTestDir = 'test.tmp.d';

  beforeEach(() => {
    fs.emptyDirSync(scratchTestDir);
  });

  it('should read/write/update artifact files', () => {
    interface Foo {
      count: number;
    }

    const { corpusRoot, corpusPath } = initTestCorpusDirs(scratchTestDir);
    const entry0Path = path.resolve(corpusPath, 'corpus-entry0');
    fs.mkdirSync(entry0Path);
    _.each(_.range(10), () => {
      updateCorpusJsonFile<Foo>(
        entry0Path, 'cache', 'cached-text.txt', (prev: any) => {
          if (!prev) {
            return { count: 0 };
          }

          return { count: prev.count + 1 };
        });
    });
    const finalUpdate = readCorpusJsonFile<Foo>(entry0Path, 'cache', 'cached-text.txt');
    expect(finalUpdate).toMatchObject({ count: 9 });
  });
});
