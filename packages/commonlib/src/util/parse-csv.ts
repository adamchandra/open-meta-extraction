import fs from 'fs-extra';
import * as csv from 'fast-csv';
import path from 'path';

import { Readable } from 'stream';

export function csvStream(csvfile: string): Readable {
  const csvabs = path.resolve(csvfile);
  const str = fs.createReadStream(csvabs);

  return str.pipe(csv.parse({ headers: false }));
}
