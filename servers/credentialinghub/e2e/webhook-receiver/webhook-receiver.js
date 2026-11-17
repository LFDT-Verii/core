// Records the Credentialing Hub notification webhooks so the e2e test can read them back.
const http = require('node:http');

let received = [];

const readBody = (req) =>
  new Promise((resolve) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
  });

const record = async (req, res) => {
  received.push({ headers: req.headers, rawBody: await readBody(req) });
  res.writeHead(204).end();
};

const list = (req, res) =>
  res
    .writeHead(200, { 'content-type': 'application/json' })
    .end(JSON.stringify(received));

const clear = (req, res) => {
  received = [];
  res.writeHead(204).end();
};

const notFound = (req, res) => res.writeHead(404).end();

const route = (req, res) => {
  switch (`${req.method} ${req.url}`) {
    case 'POST /cih-notification-webhooks':
      return record(req, res);
    case 'GET /received':
      return list(req, res);
    case 'DELETE /received':
      return clear(req, res);
    default:
      return notFound(req, res);
  }
};

http.createServer(route).listen(3000);
