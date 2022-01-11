import _ from 'lodash';
import { prettyPrint, AlphaRecord, } from '@watr/commonlib';
import axios from 'axios';
import { chainServices, createSatelliteService, defineSatelliteService } from '@watr/commlinks';
import { runServiceHub, WorkflowServiceName, WorkflowServiceNames } from './distributed-workflow';
// import { useEmptyDatabase } from '~/db/db-test-utils';
//   await useEmptyDatabase(async () => undefined);

describe('End-to-end Extraction workflows', () => {
  const hubName = 'ServiceHub';
  process.env['service-comm.loglevel'] = 'debug';
  // process.env['UploadIngestor.loglevel'] = 'debug';
  // process.env['Spider.loglevel'] = 'debug';

  const sampleRecs: AlphaRecord[] = _.map(_.range(4), (n) => {
    return ({
      noteId: `note-${n}`,
      dblpConfId: `dblp.org/conf/c-${n}/199${n}`,
      title: `title-${n}`,
      authorId: `auth-${n}`,
      url: `http://foo.bar/${n}`,
    });
  });

  // const liveRecs: AlphaRecord[] = _.flatMap(liveAlphaRecs, rec => {
  //   if (rec.trim().length === 0) return [];
  //   // const [noteId, dblpConfId, title, authorId, url] = rec.split(',');
  //   const [noteId, dblpConfId, title, url] = rec.split(',');
  //   return [{ noteId, dblpConfId, title, url, }];
  // });


  it('should run end-to-end', async () => {

    const MockService = defineSatelliteService<void>(
      async () => undefined, {
    });

    const serviceChainWorkers: WorkflowServiceName[] = [
      'MockService',
      'UploadIngestor',
      // 'Spider',
      // 'FieldExtractor',
      // 'FieldBundler',
    ];

    const [hubService, hubConnected] = await runServiceHub(hubName, false, serviceChainWorkers);

    const satellites = await Promise.all(_.map(
      serviceChainWorkers,
      // (service) => runService(hubName, service, false)
      (service) => createSatelliteService(hubName, service)
    ));

    await hubConnected();

    // TODO this won't work in a distributed environment if you have to get the commLink to make the linkage
    // Should be based on service name and nothing more
    const commLinks = _.map(satellites, ts => ts.commLink);

    // TODO make this chain the services, not the commlinks
    chainServices('run', commLinks);

    const retval = await axios.post(
      'http://localhost:3100/extractor/record.json', {
      json: liveRecs[0]
    });

    prettyPrint({ retval: retval });
  });

});
