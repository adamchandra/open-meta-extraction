import 'chai/register-should';
import _ from 'lodash';
// import { runServiceHub, runService, WorkflowServiceNames } from './inline-workflow';
import { prettyPrint, AlphaRecord, } from '@watr/commonlib';
import got from 'got';
import { chainServices } from '@watr/commlinks';
import { runService, runServiceHub, WorkflowServiceNames } from './workflow-services';

describe('End-to-end Extraction workflows', () => {
  const hubName = 'ServiceHub';
  const orderedServices = WorkflowServiceNames;
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

  const liveAlphaRecs = (`
ztPoaj50mvz,dblp.org/journals/CORR/2020,Private Query Release Assisted by Public Data,https://arxiv.org/abs/2004.10941
`).split('\n')

  // jvTLiOGJOg,dblp.org/conf/CC/2020,A study of event frequency profiling with differential privacy,https://doi.org/10.1145/3377555.3377887
  // nLTHmurMJm6,dblp.org/conf/AISTATS/2019,Linear Queries Estimation with Local Differential Privacy,http://proceedings.mlr.press/v89/bassily19a.html
  // zm9Tm38yTR,dblp.org/conf/SCAM/2019,Introducing Privacy in Screen Event Frequency Analysis for Android Apps,https://doi.org/10.1109/SCAM.2019.00037
  // yx79SuEORwC,dblp.org/journals/CORR/2019,Privately Answering Classification Queries in the Agnostic PAC Model,http://arxiv.org/abs/1907.13553

  const liveRecs: AlphaRecord[] = _.flatMap(liveAlphaRecs, rec => {
    if (rec.trim().length===0) return [];
    // const [noteId, dblpConfId, title, authorId, url] = rec.split(',');
    const [noteId, dblpConfId, title, url] = rec.split(',');
    return [{ noteId, dblpConfId, title, url, }];
  });



  it('should run end-to-end', async (done) => {

    const [hubService, hubConnected] = await runServiceHub(hubName, false, orderedServices);

    const satellites = await Promise.all(_.map(
      orderedServices,
      (service) => runService(hubName, service, false)
    ));

    await hubConnected();

    const commLinks = _.map(satellites, ts => ts.commLink);

    chainServices('run', commLinks);

    const retval = await got.post(
      'http://localhost:3100/extractor/record.json', {
      json: liveRecs[0]
    });

    prettyPrint({ retval: retval.body });

  });

});
