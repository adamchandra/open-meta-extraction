import _ from 'lodash';
import { Context } from 'koa';
import Router from 'koa-router';
import koaBody from 'koa-body';

import {
  AlphaRecord,
  prettyPrint
} from '@watr/commonlib';
import {
  fetchOneRecord,
  WorkflowServices
} from '~/workflow/workflow-services';


async function postRecordJson(
  workflowServices: WorkflowServices,
  ctx: Context,
  next: () => Promise<any>
): Promise<Router> {
  const requestBody = ctx.request.body;
  const responseBody: Record<string, string> = {};
  ctx.response.body = responseBody;

  const { log, dbCtx } = workflowServices;

  if (requestBody) {
    log.info(`got request ${requestBody}`);
    prettyPrint({ requestBody });
    const decoded = AlphaRecord.decode(requestBody);
    if (_.isString(decoded)) {
      responseBody.status = 'error';
      responseBody.errors = decoded;
    } else {
      const responseRec = await fetchOneRecord(dbCtx, workflowServices, decoded);
      _.merge(responseBody, responseRec);
    }
  } else {
    responseBody.status = 'error';
    responseBody.errors = 'Empty request body';
  }

  return next();
}

async function getRoot(ctx: Context, next: () => Promise<any>): Promise<Router> {
  const p = ctx.path;
  console.log('getRoot', p);
  return next();
}

export function initPortalRouter(workflowServices: WorkflowServices): Router {
  const apiRouter = new Router({});
  const pathPrefix = '^/extractor';

  const postRecordJson_ = _.curry(postRecordJson)(workflowServices);

  apiRouter
    .get(new RegExp(`${pathPrefix}/$`), getRoot)
    .post(new RegExp(`${pathPrefix}/record.json$`), koaBody(), postRecordJson_)
  ;

  return apiRouter;
}
