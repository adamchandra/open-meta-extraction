import _ from 'lodash';
import through from 'through2';
import { getDirWalkerStream } from './dirstream';

describe('File corpus operations', () => {
  const testDirPath = './test/resources/test-dirs';

  it('should traverse all files/directories using readable stream', async () => {
    const expectedDirs = [
      'test/resources/test-dirs/a/b/c',
      'test/resources/test-dirs/a/b/d',
      'test/resources/test-dirs/a/b',
      'test/resources/test-dirs/a/e/f',
      'test/resources/test-dirs/a/e',
      'test/resources/test-dirs/a/g',
      'test/resources/test-dirs/a',
      './test/resources/test-dirs'
    ];


    const filesRead: string[] = [];

    const dirStream = getDirWalkerStream(testDirPath, false);

    dirStream.pipe(through.obj(
      (chunk: string, _enc: string, next: (err: any, v: any) => void) => {
        filesRead.push(chunk);
        next(null, chunk);
      },
      (end) => {
        // prettyPrint({ filesRead, expectedDirs });
        expect(filesRead).toStrictEqual(expectedDirs);
        end();
      }
    ));
  });
});
