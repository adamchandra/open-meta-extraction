import _ from 'lodash';
import xml2js from 'xml2js';

import { flow as fptsFlow, pipe } from 'fp-ts/function';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import path from 'path';

import {
  ArtifactSubdir,
  expandDir,
  readCorpusTextFile,
  setLogLabel,
  writeCorpusTextFile,
  diffByChars,
  runTidyCmdBuffered,
  runFileCmd,
  prettyPrint
} from '@watr/commonlib';


import {
  Transform,
  ExtractionEnv,
  ControlInstruction,
  NormalForm,
  forEachDo,
  FilterTransform,
  through,
  filter,
  tap,
  tapLeft,
  ClientFunc,
  ClientResult,
  takeWhileSuccess,
  log,
  FieldCandidate,
  ExtractionSharedEnv
} from '~/predef/extraction-prelude';


import { ExtractionEvidence, Field } from '~/predef/extraction-records';

import {
  expandCaseVariations,
  getElemAttr,
  getElemText,
  selectAll,
  selectElemAttr,
  selectOne
} from './html-query-primitives';

import {
  AbstractCleaningRules,
  CleaningRule,
  CleaningRuleResult
} from './data-cleaning';

export type CacheFileKey = string;

export const compose: typeof fptsFlow = (...fs: []) =>
  <A extends readonly unknown[]>(a: A) =>
    pipe(a, ...fs);

export function _addEvidence(env: ExtractionEnv, evidence: string, weight: number = 0) {
  const e: ExtractionEvidence = {
    kind: 'evidence',
    evidence,
    weight
  };

  env.evidence.push(e);
}

function removeEvidence(env: ExtractionEnv, regex: RegExp) {
  const filtered = _.filter(env.evidence, (er) => !regex.test(er.evidence));
  env.evidence.splice(0, env.evidence.length, ...filtered);
}

export const addEvidence: <A>(f: (a: A, env: ExtractionEnv) => string) => Transform<A, A> =
  (f) => tap((a, env) => _addEvidence(env, f(a, env)));

export const tapEnvLR: <A>(f: (env: ExtractionEnv) => unknown) => Transform<A, A> = (f) => compose(
  tap((_0, env) => f(env)),
  tapLeft((_0, env) => {
    f(env);
  })
);

export const clearEvidence: (evidenceTest: RegExp) => Transform<unknown, unknown> = (evidenceTest: RegExp) => {
  return tapEnvLR((env) => removeEvidence(env, evidenceTest));
};


function getCurrentEvidenceStrings(env: ExtractionEnv): string[] {
  return _.map(env.evidence, ef => {
    const { evidence, weight } = ef;
    const w = weight > 0 ? `::weight=+${weight}`
      : (weight < 0 ? `::weight=-${weight}`
        : '');

    return `${evidence}${w}`;
  });
}

function saveFieldRecs(env: ExtractionEnv): void {
  const grouped = _.groupBy(env.fields, (f) => f.name);
  _.each(
    _.toPairs(grouped),
    ([name, fields]) => {
      _.update(
        env.fieldRecs, name, (fieldRecs: Field[]) => {
          if (fieldRecs === undefined) {
            return [...fields];
          }
          return _.concat(fieldRecs, fields);
        }
      );
    }
  );
}

const listArtifactFiles: (artifactDir: ArtifactSubdir, regex: RegExp) => Transform<unknown, CacheFileKey[]> =
  (dir, regex) => through((_a, env) => {
    const { entryPath } = env;
    const artifactRoot = path.join(entryPath, dir);
    const exDir = expandDir(artifactRoot);
    const matching = _.filter(exDir.files, f => regex.test(f));
    const keys: CacheFileKey[] = _.map(matching, f => path.join(dir, f));
    return keys;
  }, 'listArtifacts');


const listResponseBodies = listArtifactFiles('.', /response-body|response-frame/);

const tidyHtmlTask: (filename: string) => TE.TaskEither<string, string[]> = (filepath: string) => {
  const tidyOutputTask = () => runTidyCmdBuffered(filepath)
    .then(([stderr, stdout, _exitCode]) => {
      // Tidy  exit codes = 0: ok, 1: warnings, 2: errors
      const hasStdout = _.some(stdout, line => line.trim().length > 0);
      if (hasStdout) {
        return E.right<string, string[]>(stdout);
      }
      const errString = _.find(stderr, l => l.trim().length > 0);
      const err = errString !== undefined ? errString : 'unknown error';
      return E.left<string, string[]>(err);
    });
  return tidyOutputTask;
};


const listTidiedHtmls: Transform<unknown, CacheFileKey[]> = through((_z, env) => {
  const { fileContentCache } = env;
  const normType: NormalForm = 'tidy-norm';
  const cacheKeys = _.map(
    _.toPairs(fileContentCache), ([k]) => k
  );
  return _.filter(cacheKeys, k => k.endsWith(normType));
}, 'list(tidy)');


const loadXML: Transform<string, any> = through((artifactPath, env) => {
  const { fileContentCache, entryPath } = env;
  const normType: NormalForm = 'original';

  const cacheKey = `${artifactPath}.${normType}`;

  if (cacheKey in fileContentCache) {
    return ClientFunc.success(cacheKey);
  }

  // TODO this use of 'cache', vs '.' is unnecessary and confusing
  const maybeCachedContent = readCorpusTextFile(entryPath, '.', artifactPath);
  // prettyPrint({ msg: 'loadXML', maybeCachedContent })

  if (maybeCachedContent) {
    return pipe(
      TE.right({}),
      TE.bind('parsed', ({ }) => () => xml2js.parseStringPromise(maybeCachedContent).then(E.right)),
      TE.bind('cacheKey', ({ parsed }) => {
        fileContentCache[cacheKey] = parsed;
        return TE.right(cacheKey);
      }),
      TE.map(({ cacheKey }) => cacheKey)
    );
  }

  return ClientFunc.halt(`loadXML Fail for ${artifactPath}`)
}, 'loadXML');

const runHtmlTidy: Transform<string, string> = through((artifactPath, env) => {
  // TODO I don't think the cache key is working...
  const { fileContentCache, entryPath } = env;
  const normType: NormalForm = 'tidy-norm';
  const cacheKey = `${artifactPath}.${normType}`;
  if (cacheKey in fileContentCache) {
    return ClientFunc.success(cacheKey);
  }
  const maybeCachedContent = readCorpusTextFile(entryPath, 'cache', cacheKey);
  if (maybeCachedContent) {
    fileContentCache[cacheKey] = maybeCachedContent;
    return ClientFunc.success(cacheKey);
  }
  const fullPath = path.resolve(entryPath, artifactPath);

  const maybeTidy: ClientResult<string> = pipe(
    tidyHtmlTask(fullPath),
    TE.map((lines: string[]) => {
      const tidiedContent = lines.join('\n');
      writeCorpusTextFile(entryPath, 'cache', cacheKey, tidiedContent);
      fileContentCache[cacheKey] = tidiedContent;

      return cacheKey;
    }),
    TE.mapLeft((message) => {
      const ci: ControlInstruction = ['halt', message];
      return ci;
    })
  );

  return maybeTidy;
}, 'runHtmlTidy');


const verifyFileType: (urlTest: RegExp) => FilterTransform<string> = (typeTest: RegExp) => filter((filename, env) => {
  const file = path.resolve(env.entryPath, filename);

  const test = runFileCmd(file).then(a => typeTest.test(a));
  return test;
}, `m/${typeTest.source}/`);

export const readCache: Transform<CacheFileKey, string> = through(
  (cacheKey: CacheFileKey, { fileContentCache }) => (cacheKey in fileContentCache
    ? fileContentCache[cacheKey]
    : ClientFunc.halt(`cache has no record for key ${cacheKey}`)), `readCache`);


export const grepFilter: (regex: RegExp) => Transform<CacheFileKey, string[]> = (regex) => compose(
  readCache,
  through((content: string) => {
    const lines = _.split(content, '\n');
    return _.filter(lines, l => regex.test(l));
  }, `grep(${regex.source})`)
);


// TODO make this consistent by introducing read/splitstring/etc
export const grepFilterNot: (regex: RegExp) => Transform<string[], string[]> = (regex) => compose(
  through((lines: string[]) => {
    return _.filter(lines, l => !regex.test(l));
  }, `grep(${regex.source})`)
);


export const grepDropUntil: (regex: RegExp) => Transform<CacheFileKey, string[]> = (regex) => compose(
  readCache,
  through((content: string) => {
    const lines = _.split(content, '\n');
    const filtered = _.dropWhile(lines, l => !regex.test(l));
    return filtered;
  }, `grepDropUntil(${regex.source})`)
);

export const grepTakeUntil: (regex: RegExp) => Transform<string[], string[]> = (regex) => compose(
  through((lines: string[]) => {
    const filtered = _.takeWhile(lines, l => !regex.test(l));
    return filtered;
  }, `grepTakeUntil(${regex.source})`)
);

export const dropN: (num: number) => Transform<string[], string[]> = (num) => compose(
  through((lines: string[]) => {
    return _.drop(lines, num);
  }, `dropN(${num})`)
);

export const joinLines: (join: string) => Transform<string[], string> = (joinstr) => compose(
  through((lines: string[]) => {
    return _.join(lines, joinstr);
  }, `joinLines(${joinstr})`)
);


/// ////////////
// jquery/css selector and Elem functions



export const saveEvidence: (evidenceName: string) => Transform<string, unknown> = (evidenceName) => through((extractedValue: string, env) => {
  if (_.isString(extractedValue)) {
    const text = extractedValue.trim();
    const candidate: FieldCandidate = {
      text,
      evidence: getCurrentEvidenceStrings(env),
    };
    env.fieldCandidates.push(candidate);
  }
}, `saveEvidence:${evidenceName}`);

export const selectMetaEvidence: (name: string, attrName?: string) => Transform<CacheFileKey, unknown> = (name, attrName = 'name') => {
  const evidenceName = `select:$(meta[${attrName}="${name}"])`;
  return compose(
    addEvidence(() => evidenceName),
    selectElemAttr(expandCaseVariations(name, (s) => `meta[${attrName}="${s}"]`), 'content', `meta[${attrName}="${name}"]`),
    saveEvidence(evidenceName),
    clearEvidence(/^select:/),
  );
};

export const selectElemTextEvidence: (queryString: string) => Transform<CacheFileKey, unknown> = (queryString) => {
  const evidenceName = `select:$(${queryString})`;
  return compose(
    addEvidence(() => evidenceName),
    selectOne(queryString),
    getElemText,
    saveEvidence(evidenceName),
    clearEvidence(/^select:/),
  );
};

export const selectElemAttrEvidence: (queryString: string, contentAttr: string) => Transform<CacheFileKey, unknown> = (queryString, contentAttr) => {
  const evidenceName = `select:$(${queryString}).attr(${contentAttr})`;
  return compose(
    addEvidence(() => evidenceName),
    selectElemAttr(queryString, contentAttr),
    saveEvidence(evidenceName),
    clearEvidence(/^select:/),
  );
};

export const selectAllElemAttrEvidence: (queryString: string, contentAttr: string) => Transform<CacheFileKey, unknown> = (queryString, contentAttr) => {
  const evidenceName = `select-all:$(${queryString}).attr(${contentAttr})`;
  return compose(
    addEvidence(() => evidenceName),
    selectAll(queryString),
    forEachDo(compose(
      getElemAttr(contentAttr),
      saveEvidence(evidenceName),
    )),
    clearEvidence(/^select-all:/),
  );
};



export const selectAllMetaEvidence: (name: string, attrName?: string) => Transform<CacheFileKey, unknown> = (name, attrName = 'name') => {
  const evidenceName = `select-all:$(meta[${attrName}="${name}"])`;
  return compose(
    addEvidence(() => evidenceName),
    selectAll(expandCaseVariations(name, (s) => `meta[${attrName}="${s}"]`), `meta[${attrName}="${name}"]`),
    forEachDo(compose(
      getElemAttr('content'),
      saveEvidence(evidenceName),
    )),
    clearEvidence(/^select-all:/),
  );
};


export const selectXMLTag: (selectorPath: string[]) => Transform<CacheFileKey, unknown> = (selectorPath) => {
  const sel = selectorPath.join('.');
  const evidenceName = `xml:select:'${sel}'`;
  return compose(
    readCache,
    addEvidence(() => evidenceName),
    through((a) => {
      const selected = _.get(a, selectorPath);
      const selstr = selected.toString();
      return E.right(selstr);
    }),
    saveEvidence(evidenceName),
    clearEvidence(/^xml:select:/),
  );
};


/// // End jquery/css selector and Elem functions
/// ///////////////


const urlMatcher: (urlTest: RegExp) => Transform<unknown, unknown> = (regex) => compose(
  through((_a, env) => env.urlFetchData.responseUrl),
  filter((a: string) => regex.test(a), `url ~= m/${regex.source}/`),
);

export const statusFilter: Transform<unknown, unknown> = compose(
  through((_a, env) => env.urlFetchData.status),
  filter((a) => a === '200', 'HttpStatus==200'),
);

export const normalizeHtmls: Transform<unknown, string[]> = compose(
  listResponseBodies,
  forEachDo(
    compose(
      verifyFileType(/html|xml/i),
      runHtmlTidy,
    )
  ),
);

export const urlFilter: (urlTest: RegExp) => Transform<unknown, unknown> = (regex) => compose(
  urlMatcher(regex),
  statusFilter
);

export const checkStatusAndNormalize = compose(
  log('info', (_0, env) => `Processing ${env.urlFetchData.responseUrl}`),
  statusFilter,
  normalizeHtmls,
  filter((a) => a.length > 0),
);


export const forXMLInputs: (re: RegExp, arrow: Transform<string, unknown>) => Transform<unknown, unknown> = (re, arrow) => compose(
  listArtifactFiles('.', re),
  forEachDo(
    compose(
      loadXML,
      log('info', a => `processing input ${a}`),
      addEvidence((a) => `input:${a}`),
      arrow,
      clearEvidence(/^input:/),
    )
  )
);

export const forInputs: (re: RegExp, arrow: Transform<string, unknown>) => Transform<unknown, unknown> = (re, arrow) => compose(
  listTidiedHtmls,
  through((inputs) => _.filter(inputs, input => re.test(input)), `m/${re.source}/`),
  forEachDo(
    compose(
      log('info', a => `processing input ${a}`),
      addEvidence((a) => `input:${a}`),
      arrow,
      clearEvidence(/^input:/),
    )
  )
);

export const tryEvidenceMapping: (mapping: Record<string, string>) => Transform<unknown, unknown> = (mapping) => {
  const evidenceKeys = _.keys(mapping);
  const filters = _.map(evidenceKeys, e => evidenceExists(e));
  const keyEvidence = _.join(evidenceKeys, ' ++ ');


  return compose(
    takeWhileSuccess(...filters),
    tap((_a, env) => {
      prettyPrint({ candidates: env.fieldCandidates });

      _.each(evidenceKeys, evKey0 => {
        const fieldName = mapping[evKey0];

        const evKey = evKey0.endsWith('?') ? evKey0.slice(0, -1) : evKey0;

        const evKeys = _.map(evKey.split('|'), s => s.trim());

        _.each(evKeys, (key) => {
          const maybeCandidates = candidatesForEvidence(env, key);

          _.each(maybeCandidates, c => {
            const { text, evidence } = c;

            const field: Field = {
              name: fieldName,
              evidence: [...evidence, keyEvidence],
              value: text
            };

            if (fieldName === 'abstract:raw') {
              const [cleaned0, cleaningRuleResults] = applyCleaningRules(AbstractCleaningRules, text);
              field.name = 'abstract';
              field.value = cleaned0;
              const ruleNames = _.map(cleaningRuleResults, r => {
                return `clean: ${r.rule}`;
              });
              field.evidence.push(...ruleNames);
            }
            if (field.value !== undefined && field.value.length > 0) {
              env.fields.push(field);
            }
          });
        });
      });
      saveFieldRecs(env);
    }),
    tap((_a, env) => {
      _.remove(env.fields, () => true);
      _.remove(env.fieldCandidates, () => true);
    })
  );
};

const candidatesForEvidence: (env: ExtractionEnv, evstr: string) => FieldCandidate[] = (env, evstr) => {
  const regex = new RegExp(evstr);
  return _.filter(env.fieldCandidates, (fc) => {
    return _.some(fc.evidence, ev => regex.test(ev));
  });
};


const evidenceExists: (evstr: string) => FilterTransform<unknown> = (evstr) => filter((_a, env) => {
  if (evstr.endsWith('?')) return true;
  const evRes = _.map(evstr.split('|'), s => new RegExp(s.trim()));
  return _.some(evRes, regex => {
    return _.some(
      env.fieldCandidates, (fc) => {
        return _.some(fc.evidence, ev => regex.test(ev));
      }
    );
  });
}, evstr);

export const summarizeEvidence: Transform<unknown, unknown> = tapEnvLR((env) => {
  const { fieldCandidates, log } = env;
  const url = env.urlFetchData.responseUrl;

  log.log('info', `summary: URL= ${url}`);

  log.log('info', 'summary: Field Candidates');
  _.each(fieldCandidates, fc => {
    log.log('info', `summary:     ${fc.text}`);
    _.each(fc.evidence, ev => {
      log.log('info', `summary:         ${ev}`);
    });
  });

  log.log('info', 'summary: Field Records');
  const nameValuePairs = _.toPairs(env.fieldRecs);
  _.each(nameValuePairs, ([name, fields]) => {
    env.log.log('info', `summary:     Field: ${name}  count=${fields.length}`);
    _.each(fields, field => {
      const { name, value, evidence } = field;
      log.log('info', `summary:        ${name} ==> ${value}`);
      _.each(evidence, ev => {
        log.log('info', `summary:            ${ev}`);
      });
    });
  });
  log.log('info', 'summary: ');
});


function applyCleaningRules(rules: CleaningRule[], initialString: string): [string, CleaningRuleResult[]] {
  let currentString = initialString;
  const cleaningResults: CleaningRuleResult[] = [];
  _.each(rules, (rule) => {
    const someGuardMatches = (
      rule.guards.length === 0
      || rule.guards.some(re => re.test(currentString))
    );

    if (!someGuardMatches) return;

    const cleaned = rule.run(currentString, rule.guards);
    if (cleaned === undefined) return;
    if (cleaned !== currentString) {
      const changes = diffByChars(currentString, cleaned, { brief: true });
      cleaningResults.push({
        rule: rule.name,
        changes,
      });
      currentString = cleaned;
    }
  });
  return [currentString, cleaningResults];
}

export async function initExtractionEnv(
  entryPath: string,
  sharedEnv: ExtractionSharedEnv,
): Promise<ExtractionEnv> {
  const { log, browserPool, urlFetchData } = sharedEnv;
  if (urlFetchData === undefined) throw new Error('error state: urlFetchData is undefined');

  const pathPrefix = path.basename(entryPath).slice(0, 6);
  const logPrefix = [pathPrefix];

  const browserInstance = await browserPool.acquire();

  const env: ExtractionEnv = {
    log,
    browserPool,
    browserInstance,
    ns: logPrefix,
    entryPath,
    urlFetchData,
    fields: [],
    fieldRecs: {},
    fieldCandidates: [],
    evidence: [],
    fileContentCache: {},
    browserPageCache: {},
    enterNS(ns: string[]) {
      setLogLabel(log, _.join(ns, '/'));
    },
    exitNS(ns: string[]) {
      setLogLabel(log, _.join(ns, '/'));
    }
  };
  return env;
}
