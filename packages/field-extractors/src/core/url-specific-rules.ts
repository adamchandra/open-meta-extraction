/**
 * URL-Specific rules for gathering metadata from html/xml
 *
 * Rules are broken out into separate files just for organization,
 * and to avoid overly long files
 **/

import {
  attemptEach,
} from '~/predef/extraction-prelude';

import {
  gatherDublinCoreTags,
  gatherHighwirePressTags,
  gatherOpenGraphTags,
} from './headtag-scripts';

import * as u1 from './url-specific-rules-1';
import * as u2 from './url-specific-rules-2';
import * as u3 from './url-specific-rules-3';

export const UrlSpecificAttempts = attemptEach(
  u1.arxivOrgRule,
  u1.scienceDirectRule,
  u1.dlAcmOrgRule,
  u1.aclwebOrgRule,
  u1.ijcaiOrgRule,
  u1.mitpressjournalsOrgRule,
  u1.academicOupComRule,
  u1.nipsCCRule,
  u1.iospressComRule,
  u1.digitalHumanitiesOrg,
  u1.kybernetikaCz,
  u2.ieeExploreOrgRule,
  u2.linkSpringerComRule,
  u3.neuripsCCRule,
  u3.iscaSpeechOrgRule,
  u3.lrecConfOrg,
  u3.cogsciMindmodelingOrg
);
