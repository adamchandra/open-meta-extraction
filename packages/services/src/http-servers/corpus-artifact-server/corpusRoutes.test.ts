import _ from 'lodash';
import path from 'path';

// import { readCorpusEntries } from "./corpusRoutes";
import fs from 'fs-extra';

const scratchDir = path.join('.', 'scratch.d');
const corpusRoot = path.join(scratchDir, 'corpus-root.d');


describe('read corpus entries', () => {
  const dirnames = _.map(_.range(1, 10), (i) => `entry_${i}.d`);
  const artifactPaths = [
    'pdf',
    'page-images',
    'page-thumbs',
    'textgrids',
    'tracelogs',
  ];

  fs.mkdirpSync(corpusRoot);

  // afterEach(() => fs.rmdirSync(corpusRoot))
  // afterAll(() => fs.rmdirSync(corpusRoot))

  beforeEach(() => {
    fs.emptyDirSync(corpusRoot);
    fs.rmdirSync(corpusRoot);
    fs.mkdirpSync(corpusRoot);
    fs.writeFileSync(path.join(corpusRoot, '.corpus-root'), '');
    const dirs = dirnames.map(dir => path.join(corpusRoot, dir));

    _.each(dirs, (dir, i) => {
      fs.mkdirpSync(dir);

      _.each(artifactPaths, (p, i) => {
        const artifactPath = path.join(dir, p);
        fs.mkdirpSync(artifactPath);
        _.each(_.range(0, i+2), num => {
          const artifact = path.join(artifactPath, `artifact-${p}-#${num}`);
          fs.writeFileSync(artifact, '');
        });
      });

      const pdfArtifact = path.join(dir, `the-paper-${i}.pdf`);
      fs.writeFileSync(pdfArtifact, 'pdf content');
    });
  });


  it('read entries', () => {
    // const entries = readCorpusEntries(corpusRoot, 0, 20);
    // console.log(entries);
  });
});

// 10.1101-001875.d                                                                                                                         ⬆ ✱ ◼
//   001875.full.pdf
//   bioarxiv.json
//   page-images/
//   page-thumbs/
//   textgrid.json
//   tracelogs/
