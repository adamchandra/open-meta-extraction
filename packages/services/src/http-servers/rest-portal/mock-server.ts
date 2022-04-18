import _ from 'lodash';
import Koa, { Context } from 'koa';
import koaBody from 'koa-body';
import Router from '@koa/router';
import { Server } from 'http';
import { delay, prettyPrint, stripMargin, getServiceLogger, prettyFormat } from '@watr/commonlib';

const withFields = stripMargin(`
|<html>
|  <head>
|    <meta name="citation_author" content="Holte, Robert C." />
|    <meta name="citation_author" content="Burch, Neil" />
|    <meta name="citation_title" content="Automatic move pruning for single-agent search" />
|    <meta name="dc.Creator" content="Adam" />
|    <meta name="dc.creator" content="adam" />
|    <meta property="og:description" content="success: We consider a new learning model in which a joint distributi" />
|  </head>
|
|  <body>
|    <section class="Abstract" id="Abs1" tabindex="-1" lang="en" xml:lang="en">
|      <h2 class="Heading">
|        Abstract
|      </h2>
|      <p class="Para">
|        success: We present
|      </p>
|    </section>
|    <a class="show-pdf" href="/success:pdf">PDF</a>
|
|    <div class="Abstracts u-font-serif" id="abstracts">
|        <div class="abstract author" id="aep-abstract-id6">
|            <h2 class="section-title u-h3 u-margin-l-top u-margin-xs-bottom">
|                Abstract
|            </h2>
|            <div id="aep-abstract-sec-id7">
|                <p>
|                    success1
|                </p>
|                <p>
|                    success2
|                </p>
|            </div>
|        </div>
|    </div>
|
|  </body>
|</html>
`);

const withoutFields = `
<html> <head> </head> <body> </body> </html>
`;

const htmlSamples: Record<string, string> = {
  withFields,
  withoutFields,
  custom404: '<html><body>404 Not Found</body></html>'
};

const log = getServiceLogger('test-server');

function openreviewRouter(): Router<Koa.DefaultState, Koa.DefaultContext> {
  const router = new Router({
    prefix: '/api.openreview.net'
  });

  async function postLogin(ctx: Context): Promise<void> {
    const { user, password } = ctx.request.body;
    log.info(`user: ${user}: password: ${password}`);
    // interface Credentials {
    ctx.response.body = {
      token: 'mock-token',
      user: { id: 29 }
    };
  }

  async function getNotes(ctx: Context): Promise<void> {
    const fmt = prettyFormat(ctx.request.query, { colors: false })
    log.info(fmt);
    ctx.response.body = {
      notes: [],
      count: 0
    };
  }

  router.post('/login', koaBody(), postLogin);

  router.get('/notes', getNotes);

  return router;
}

function htmlRouter(): Router<Koa.DefaultState, Koa.DefaultContext> {
  const router = new Router({ routerPath: '/htmls' });

  router.get(/[/].*/, async (ctx: Context, next: () => Promise<any>) => {
    const { response, path } = ctx;
    prettyPrint({ testServer: path });
    const pathTail = path.slice('/htmls/'.length);
    // const pathTail = path.slice(1);
    const [status, respKey, maybeTimeout] = pathTail.split(/~/);
    const timeout = maybeTimeout ? Number.parseInt(maybeTimeout) : 0;
    prettyPrint({ status, respKey, timeout });

    response.type = 'html';
    response.status = Number.parseInt(status, 10);
    response.body = htmlSamples[respKey] || 'Unknown';
    await next();
  });

  router.use(async (ctx, next) => {
    log.info(`HTMLS: ${ctx.method} ${ctx.path}`)
    await next();
    log.info(`HTMLS:END: ${ctx.method} ${ctx.path}`)
  });

  router

  return router;
}

function rootRouter(): Router<Koa.DefaultState, Koa.DefaultContext> {
  const router = new Router();

  router.use(async (ctx: Context, next) => {
    log.info('Root 0')
    ctx.set('Access-Control-Allow-Origin', '*');
    return next();
  });

  router.use(async (ctx, next) => {
    log.info(`ROOT:${ctx.method} ${ctx.path}`)
    await next();
    log.info(`ROOT:END ${ctx.method} ${ctx.path}`)
  });

  return router;
}

export async function startSpiderableTestServer(): Promise<Server> {
  const app = new Koa();

  const port = 9100;

  const root = rootRouter();
  const hrouter = htmlRouter();

  root.use(hrouter.routes());

  app.use(async (ctx, next) => {
    log.info(`${ctx.method} ${ctx.path}`)
    await next();
    log.info(`END ${ctx.method} ${ctx.path} ${ctx.status}`)
  });

  app.use(root.routes());

  return new Promise((resolve) => {
    const server = app.listen(port, () => {
      log.info(`Koa is listening to http://localhost:${port}`);
      resolve(server);
    });
  });
}
