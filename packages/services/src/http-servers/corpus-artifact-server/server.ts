import Koa, { Context } from 'koa';
import Router from 'koa-router';
import json from 'koa-json';
// import opts from 'commander';

import { initFileBasedRoutes } from './corpusRoutes';

const rootRouter = new Router();
const app = new Koa();

// opts
//   .version('0.1.0')
//   .option('--corpus <path>', 'Path to corpus')
//   .option('--port <port>', 'port to listen to')
//   .parse(process.argv)
//   ;

// const { corpus } = opts;
const corpus = 'TODO';

const apiRouter = initFileBasedRoutes(corpus);

rootRouter
  .use('/', ((ctx: Context, next) => {
    ctx.set('Access-Control-Allow-Origin', '*');
    return next();
  }))
  .use(apiRouter.routes())
  .use(apiRouter.allowedMethods())
;

app
  .use(rootRouter.routes())
  .use(rootRouter.allowedMethods())
  .use(json({ pretty: false }))
;

app.listen(3100, () => {
  console.log('Koa is listening to http://localhost:3100');
});
