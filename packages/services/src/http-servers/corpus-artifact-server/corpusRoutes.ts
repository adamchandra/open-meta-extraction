import _ from 'lodash';

// import pumpify from "pumpify";
import path from 'path';
import fs from 'fs-extra';
import send from 'koa-send';

import { Context } from 'koa';
import Router from 'koa-router';

import {
  CorpusEntry,
  getDirWalkerStream,
} from '@watr/commonlib';


export interface CorpusPage {
  corpusEntries: CorpusEntry[];
  offset: number;
}

export async function listCorpusArtifacts(
  entryPath: string,
): Promise<string[]> {
  const pipe = getDirWalkerStream(entryPath, true);

  return new Promise((resolve) => {
    const artifacts: string[] = [];

    pipe.on('data', (p: string) => artifacts.push(p));
    pipe.on('end', () => resolve(artifacts));
  });
}

export async function resolveArtifact(
  entryPath: string,
  remainingPath: string[]
): Promise<string | undefined> {
  const allpaths = await listCorpusArtifacts(entryPath);

  const isFile = (f: string) => fs.statSync(f).isFile();
  const isNumeric = (s: string) => /^\d+$/.test(s);

  const listing = _(allpaths)
    .filter(p => isFile(p))
    .map((p: string) => {
      const rel = path.relative(entryPath, p);
      return [p, rel.split('/')] as const;
    })
    .value();

  _.each(remainingPath, (ppart, partIndex) => {
    _.remove(listing, ([, relParts]) => {
      const relPart = relParts[partIndex];
      if (relPart === undefined) {
        return true;
      }
      let boundedRE = ppart;
      if (isNumeric(ppart)) {
        boundedRE = `\\D${ppart}\\D`;
      }

      const testRe = new RegExp(boundedRE);
      return !testRe.test(relPart);
    });
  });

  if (listing.length === 1) {
    const [responseFile] = listing[0];
    return responseFile;
  }
  return undefined;
}

export function initFileBasedRoutes(corpusRootPath: string): Router {
  // TODO get this prefixed route working properly
  const apiRouter = new Router({
    // prefix: "/api"
  });
  const pathPrefix = '/api/corpus/entry';
  const pathMatcher = `${pathPrefix}/([^/]+)((/[^/]+)|/)*`;
  const re = new RegExp(pathMatcher);

  apiRouter
    .get(re, async (ctx: Context, next) => {
      const p = ctx.path;

      // map path entry id to physical path
      const endPath = p.slice(pathPrefix.length + 1);
      const pathParts = endPath.split('/');
      const [entryId, ...remainingPath] = pathParts;
      const entryPath = path.resolve(corpusRootPath, entryId);
      const artifactPath = await resolveArtifact(entryPath, remainingPath);

      if (artifactPath) {
        const respRelFile = path.relative(corpusRootPath, artifactPath);
        console.log('serving', respRelFile);
        return send(ctx, respRelFile, { root: corpusRootPath });
      }

      return next();
    });

  return apiRouter;
}
