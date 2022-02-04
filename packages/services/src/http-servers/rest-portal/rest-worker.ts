import _ from 'lodash';

import Koa, { Context } from 'koa';
import koaBody from 'koa-body';
import Router from 'koa-router';
import json from 'koa-json';
import { Server } from 'http';
import { SatelliteCommLink } from '@watr/commlinks';
import { AlphaRecord, prettyPrint, getServiceLogger } from '@watr/commonlib';
import { RecordRequest } from '~/workflow/common/datatypes';

export interface RestPortal {
  server: Server;
}

export async function startRestWorker(commLink: SatelliteCommLink<RestPortal>): Promise<RestPortal> {
  const log = getServiceLogger('rest-worker');
  const app = new Koa();
  const rootRouter = new Router();
  const portalRouter = initPortalRouter(commLink);

  const port = 3100;

  rootRouter
    .use('/', ((ctx: Context, next) => {
      ctx.set('Access-Control-Allow-Origin', '*');
      return next();
    }))
    .use(portalRouter.routes())
    .use(portalRouter.allowedMethods())
    ;

  app
    .use(rootRouter.routes())
    .use(rootRouter.allowedMethods())
    .use(json({ pretty: false }))
    ;

  return new Promise((resolve) => {
    const server = app.listen(port, function() {
      log.info(`Koa is listening to http://localhost:${port}`);
      resolve({ server });
    });
  });
}


async function postRecordJson(
  commLink: SatelliteCommLink<RestPortal>,
  ctx: Context,
  next: () => Promise<any>
): Promise<Router> {
  const requestBody = ctx.request.body;
  const responseBody: Record<string, string> = {};
  ctx.response.body = responseBody;

  if (requestBody) {
    // TODO validate requestBody as AlphaRecord[]
    const alphaRec: AlphaRecord = requestBody;
    const restPortalResponse = await commLink.call('run', RecordRequest(alphaRec));
    prettyPrint({ restPortalResponse });

    responseBody.status = 'ok';
  } else {
    responseBody.status = 'error';
  }

  return next();
}

async function getRoot(ctx: Context, next: () => Promise<any>): Promise<Router> {
  const p = ctx.path;
  console.log('getRoot', p);
  return next();
}


export function initPortalRouter(commLink: SatelliteCommLink<RestPortal>): Router {
  const apiRouter = new Router({});
  const pathPrefix = '^/extractor'

  const postRecordJson_ = _.curry(postRecordJson)(commLink);

  apiRouter
    .get(new RegExp(`${pathPrefix}/$`), getRoot)
    .post(new RegExp(`${pathPrefix}/record.json$`), koaBody(), postRecordJson_)
  ;

  return apiRouter;
}


