import Koa, { Context } from 'koa';
import Router from 'koa-router';
import json from 'koa-json';
import { Server } from 'http';
import { arglib, setEnv } from '@watr/commonlib';
import { initPortalRouter } from './portal-routes';
import { createAppLogger } from './portal-logger';
import { WorkflowServices } from '~/workflow/workflow-services';
import { createSpiderService } from '~/workflow/spider-service';
import { getDBConfig } from '~/db/database';
import { DatabaseContext } from '~/db/db-api';

const { opt, config, registerCmd } = arglib;


export async function startRestPortal(
  dbCtx: DatabaseContext
): Promise<Server> {
  const log = createAppLogger();
  const app = new Koa();
  const rootRouter = new Router();

  const spiderService = await createSpiderService();
  const workflowServices: WorkflowServices = {
    spiderService,
    log,
    dbCtx
  };

  const portalRouter = initPortalRouter(workflowServices);

  const port = 3100;

  rootRouter
    .use('/', ((ctx: Context, next) => {
      ctx.set('Access-Control-Allow-Origin', '*');
      return next();
    }))
    // .use(koaBody({ multipart: true }))
    .use(portalRouter.routes())
    .use(portalRouter.allowedMethods())
  ;

  app
    .use(rootRouter.routes())
    .use(rootRouter.allowedMethods())
    .use(json({ pretty: false }))
  ;

  return new Promise((resolve) => {
    const server = app.listen(port, () => {
      log.info(`Koa is listening to http://localhost:${port}`);
      resolve(server);
    });
  });
}

registerCmd(
  arglib.YArgs,
  'service-portal',
  'start rest server for spidering and extraction',
  config(
    opt.existingDir('app-share-dir: root directory for shared logging/spidering/extraction data'),
  )
)((args: any) => {
  const { appShareDir } = args;
  setEnv('AppSharePath', appShareDir);
  const dbConfig = getDBConfig('production');
  if (dbConfig === undefined) {
    return;
  }

  const dbCtx: DatabaseContext = { dbConfig };

  startRestPortal(dbCtx);
});
