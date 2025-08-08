const { afterEach, beforeEach, describe, it } = require('node:test');
const { expect } = require('expect');

const fastify = require('fastify');
const { adminJwtAuthPlugin } = require('../src/admin-jwt-auth');

const testAuthToken =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyIjoidmVsb2NpdHkuYWRtaW5AZXhhbXBsZS5jb20ifQ.93NY5S7ohFv37rYYo4_TcPx3NFGdhMucK6yNmvGYE0U';

describe('auth module', () => {
  let server;

  beforeEach(() => {
    server = fastify({});
  });

  afterEach(async () => {
    await server.close();
  });

  it('the verifyAdmin function should return 200 if the user admin email matches', async () => {
    server.config = {
      secret: '1445253CA16FA4649F6D3C49E8D26',
      adminUserName: 'velocity.admin@example.com',
    };
    server
      .register(adminJwtAuthPlugin)
      .get('/', { onRequest: (req) => server.verifyAdmin(req) }, async () => {
        return 'OK';
      });

    await server.ready();
    expect(server.verifyAdmin).toEqual(expect.any(Function));

    const response = await server.inject({
      method: 'GET',
      url: '/',
      headers: {
        authorization: `Bearer ${testAuthToken}`,
      },
    });

    expect(response.statusCode).toEqual(200);
  });

  it('the verifyAdmin function should error with 401 if the user admin email doesnt match', async () => {
    server.config = {
      secret: '1445253CA16FA4649F6D3C49E8D26',
      adminUserName: 'not-an-admin@example.com',
    };
    server
      .register(adminJwtAuthPlugin)
      .get('/', { onRequest: (req) => server.verifyAdmin(req) }, async () => {
        return 'OK';
      });

    await server.ready();
    expect(server.verifyAdmin).toEqual(expect.any(Function));

    const response = await server.inject({
      method: 'GET',
      url: '/',
      headers: {
        authorization: `Bearer ${testAuthToken}`,
      },
    });

    expect(response.statusCode).toEqual(401);
  });

  it('the verifyAdmin function should error with 401 if the bearer token is invalid', async () => {
    server.config = {
      secret: 'foo',
    };
    server
      .register(adminJwtAuthPlugin)
      .get('/', { onRequest: (req) => server.verifyAdmin(req) }, async () => {
        return 'OK';
      });

    await server.ready();
    expect(server.verifyAdmin).toEqual(expect.any(Function));

    const response = await server.inject({
      method: 'GET',
      url: '/',
      headers: {
        authorization: 'Bearer foo',
      },
    });

    expect(response.statusCode).toEqual(401);
  });
});
