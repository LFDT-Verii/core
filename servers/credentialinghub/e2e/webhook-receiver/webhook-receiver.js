// Records the Credentialing Hub notification webhooks so the e2e test can read them back.
const http = require('node:http');

let received = [];

const readBody = (req) =>
  new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });

const routes = {
  'POST /cih-notification-webhooks': async (req, res) => {
    received.push({ headers: req.headers, rawBody: await readBody(req) });
    res.writeHead(204).end();
  },
  'GET /received': (req, res) => {
    res
      .writeHead(200, { 'content-type': 'application/json' })
      .end(JSON.stringify(received));
  },
  'DELETE /received': (req, res) => {
    received = [];
    res.writeHead(204).end();
  },
};

const notFound = (req, res) => res.writeHead(404).end();

http
  .createServer((req, res) =>
    (routes[`${req.method} ${req.url}`] ?? notFound)(req, res),
  )
  .listen(3000);
