import _ from 'lodash';
import { AlphaRecord, initConfig, prettyPrint } from '@watr/commonlib';
import { defineSatelliteService, SatelliteServiceDef, initCallChaining, createCommChain, defineServiceHub } from '@watr/commlinks';
import { runServiceHubAndSatellites } from './distributed-workflow';
import { UploadIngestor, FieldExtractor } from './workers';
import { Spider } from './spider-worker';


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
    const conf = initConfig();
    // prettyPrint({ conf });


    const serviceChainWorkers = [
      UploadIngestor,
      Spider,
      FieldExtractor,
    ];
    const orderedServices = serviceChainWorkers.map(w => w.name);
    const chainFunction = 'foo';

    const hubDef = defineServiceHub(
      'HubService',
      orderedServices,
      [{ chainFunction, orderedServices }],
      {
        async startup() {
          const comm = this.commLink;
          const satelliteNames: string[] = [];
          const chainResult = await createCommChain(comm, 'func1', satelliteNames);
        }
      });

    const [hubService, hubConnected, satelliteRecords] =
      await runServiceHubAndSatellites(hubDef, serviceChainWorkers);

    await hubConnected();
    // const satelliteKeyVals = _.toPairs(satelliteRecords);

    // TODO this won't work in a distributed environment if you have to get the commLink to make the linkage
    // Should be based on service name and nothing more
    // const commLinks = _.map(satelliteKeyVals, ([, sat]) => sat.commLink);

    // TODO make this chain the services, not the commlinks
    // chainServices('run', commLinks);

    // const retval = await axios.post(
    //   'http://localhost:3100/extractor/record.json', {
    //   json: liveRecs[0]
    // });
    //

    // satelliteRecords['MockRecords'].commLink.call()
    // prettyPrint({ retval: retval });
    await hubService.shutdownSatellites();
    await hubService.commLink.quit();
  });

});
