import request from 'supertest';
import _ from 'lodash';
import jsonServer from 'json-server';
import { Server } from 'http';
import { prettyPrint, putStrLn, setLogEnvLevel } from '@watr/commonlib';
import { FetchService } from './fetch-service';


type ApiData = Record<string, any>;

describe('Fetch Service', () => {

  setLogEnvLevel('debug');
  // let server = jsonServer.create();
  let httpServer: Server | undefined;

  let router: jsonServer.JsonServerRouter<ApiData>;
  let db: ApiData;

  afterEach(async () => {
    return new Promise<void>(resolve => {
      if (httpServer) {
        httpServer.close(() => {
          resolve();
        });
        httpServer = undefined;
      }
    })
    // if (server) {
    //   const s = server as any;
    //   await s.close()
    // }
  });
  beforeEach(async () => {

    // const rewriterRules = {
    //   '/api/*': '/$1',
    //   '/blog/posts/:id/show': '/posts/:id',
    //   '/comments/special/:userId-:body': '/comments/?userId=:userId&body=:body',
    //   '/firstpostwithcomments': '/posts/1?_embed=comments',
    //   '/articles\\?_id=:id': '/posts/:id',
    // }

    db = {}

    db.login = [

    ];

    db.posts = [
      { id: 1, body: 'foo' },
      { id: 2, body: 'bar' },
    ]

    db.tags = [
      { id: 1, body: 'Technology' },
      { id: 2, body: 'Photography' },
      { id: 3, body: 'photo' },
    ]

    db.users = [
      { id: 1, username: 'Jim', tel: '0123' },
      { id: 2, username: 'George', tel: '123' },
    ]

    db.comments = [
      { id: 1, body: 'foo', published: true, postId: 1, userId: 1 },
      { id: 2, body: 'bar', published: false, postId: 1, userId: 2 },
      { id: 3, body: 'baz', published: false, postId: 2, userId: 1 },
      { id: 4, body: 'qux', published: true, postId: 2, userId: 2 },
      { id: 5, body: 'quux', published: false, postId: 2, userId: 1 },
    ]

    const server = jsonServer.create();
    server.use(jsonServer.defaults())

    server.use(jsonServer.bodyParser);

    server.use((req, res, next) => {
      const { body, headers } = req;
      prettyPrint({ msg: 'middle', body, headers });
      if (req.method === 'POST') {
        req.body.createdAt = Date.now()
      }
      // Continue to JSON Server router
      next()
    })

    server.post('/login', (req, resp) => {
      const { body, headers } = req;
      prettyPrint({ msg: '/login', body, headers });
      resp.jsonp({ user: 'foo' })
    });

    router = jsonServer.router(db)
    // server.use(jsonServer.rewriter(rewriterRules))
    server.use(router)
    httpServer = server.listen(8865);
  });


  it('should smokescreen run', async () => {
    const response = await request(httpServer)
      .get('/comments?postId=2&published=true')
    // .expect('Content-Type', /json/)
    // .expect(200, [db.comments[3]])

    const { body, headers, status } = response;
    prettyPrint({ body, headers, status });
  });

  it.only('should run fetch loop', async () => {
    const fetchService = new FetchService();
    try {
      await fetchService.runFetchLoop(undefined, 4);
    } catch (error) {
      prettyPrint({ error })
    }

  });
});
