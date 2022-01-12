import _ from 'lodash';
import { prettyPrint, AlphaRecord, initConfig, } from '@watr/commonlib';
import axios from 'axios';
import { chainServices, createSatelliteService, defineSatelliteService, SatelliteService, SatelliteServiceDef } from '@watr/commlinks';
import { runServiceHub, runServiceHubAndSatellites, WorkflowServiceName, WorkflowServiceNames } from './distributed-workflow';
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
    // const conf = initConfig();
    // prettyPrint({ conf });

    const MockService = defineSatelliteService<void>(
      async () => undefined, {
    });

    const serviceChainWorkers: Record<string, SatelliteServiceDef<any>> = {
      MockService,
      // UploadIngestor,
      // 'Spider',
      // 'FieldExtractor',
      // 'FieldBundler',
    };

    const [hubService, hubConnected, satelliteRecords] =
      await runServiceHubAndSatellites(hubName, serviceChainWorkers);


    await hubConnected();
    const satelliteKeyVals = _.toPairs(satelliteRecords);

    // TODO this won't work in a distributed environment if you have to get the commLink to make the linkage
    // Should be based on service name and nothing more
    const commLinks = _.map(satelliteKeyVals, ([, sat]) => sat.commLink);

    // TODO make this chain the services, not the commlinks
    chainServices('run', commLinks);

    // const retval = await axios.post(
    //   'http://localhost:3100/extractor/record.json', {
    //   json: liveRecs[0]
    // });
    //

    // satelliteRecords['MockRecords'].commLink.yield()
    // prettyPrint({ retval: retval });
    await hubService.shutdownSatellites();
    await hubService.commLink.quit();
  });

});
