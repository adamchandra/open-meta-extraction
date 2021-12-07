import _ from 'lodash';
import path from 'path';
import fs, { } from 'fs-extra';
import stream, { Readable, Transform } from 'stream';
import through from 'through2';
// import { createPump } from '~/util/stream-pump';
// import { prettyPrint } from '~/util/pretty-print';

interface DirStackEntry {
  fullpath: string;
  expanded: boolean;
  files: string[];
}

// export async function expandDirRecursive(
//   rootDir: string,
//   includeFiles: boolean = true,
//   includeDirectories: boolean = true
// ): Promise<string[]> {
//   const corpusDirStream = getDirWalkerStream(rootDir, includeFiles, includeDirectories);

//   const allFilesP = createPump()
//     .viaStream<string>(corpusDirStream)
//     .gather()
//     .toPromise()
//     .then(files => {
//       if (files === undefined) {
//         return [];
//       }
//       return _.flatten(files);
//     });

//   return allFilesP;
// }

export function getDirWalkerStream(
  root: string,
  includeFiles: boolean = false,
  includeDirectories: boolean = true
): Readable {
  const stack: DirStackEntry[] = [{ fullpath: root, expanded: false, files: [] }];

  function expand(): DirStackEntry | undefined {
    let top = _.last(stack);
    // prettyPrint({ msg: 'pre', top });
    while (top && !top.expanded) {
      const topPath = top.fullpath;
      const dirEntries = fs.readdirSync(top.fullpath, { withFileTypes: true });
      const fileNames: string[] = _(dirEntries)
        .filter(e => e.isFile())
        .map(e => e.name)
        .sort()
        .map(e => path.join(topPath, e))
        .value();

      const dirNames = _(dirEntries)
        .filter(e => e.isDirectory())
        .map(e => e.name)
        .sort()
        .reverse()
        .map(e => {
          const fullpath = path.join(topPath, e);
          return {
            fullpath,
            expanded: false,
            files: []
          };
        })
        .value();

      top.expanded = true;
      top.files.push(...fileNames);
      stack.push(...dirNames);
      top = _.last(stack);
    }
    const next = stack.pop();
    // prettyPrint({ msg: 'post', next });
    return next;
  }

  const streamOut = new stream.Readable({
    objectMode: true,
    read() {
      const data = expand();
      // prettyPrint({ msg: 'read', data });
      if (data) {
        if (includeDirectories) {
          this.push(data.fullpath);
        }
        if (includeFiles) {
          data.files.forEach(f => this.push(f));
        }
        return;
      }
      this.push(null);
    }
  });

  return streamOut;
}

export function stringStreamFilter(test: (p: string) => boolean): Transform {
  return through.obj(
    (chunk: string, _enc: string, next: (err: any, v: string | null) => void) => {
      if (test(chunk)) {
        return next(null, chunk);
      }
      return next(null, null);
    }
  );
}
