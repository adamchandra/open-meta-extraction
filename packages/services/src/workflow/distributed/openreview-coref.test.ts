import fs from 'fs-extra';
import { OpenReviewCoref, OpenReviewCorefService } from './openreview-coref';
import { newCommLink, CommLink, nextMessageId, SatelliteService } from '@watr/commlinks';

import { connectToMongoDB } from '~/db/mongodb';

describe('Author Coreference data transfer', () => {
  process.env['service-comm.loglevel'] = 'debug';
  const workingDir = './test.scratch.d';

  beforeEach(async () => {
    const conn = await connectToMongoDB();
    await conn.connection.dropDatabase();
    fs.emptyDirSync(workingDir);
    fs.removeSync(workingDir);
    fs.mkdirSync(workingDir);
  });

  it('should populate shadow db with openreview records', async () => {
    const commLink = newCommLink<SatelliteService<OpenReviewCoref>>("CorefService");
    const corefService = await OpenReviewCorefService.cargoInit(commLink);
    await corefService.updateAuthorCorefDB(100);
    await commLink.quit()
  });
});
