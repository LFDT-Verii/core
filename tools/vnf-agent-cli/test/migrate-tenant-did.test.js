const { mock } = require('node:test');
const {
  migrateTenantDid,
} = require('../src/migrate-tenant-did/migrate-tenant-did');

describe('migrate-tenant-did test suite', () => {
  const mockFetch = (statusCode, responseBody) => {
    return Promise.resolve(
      new Response(JSON.stringify(responseBody), {
        status: statusCode,
      })
    );
  };

  const multiMockFetch = (argsArr) => {
    let counter = 0;
    return async () => {
      const result = await mockFetch(argsArr[counter][0], argsArr[counter][1]);
      // eslint-disable-next-line no-plusplus
      counter++;
      return result;
    };
  };

  it('should error if "did" and "all" flags are both provided', async () => {
    await expect(
      migrateTenantDid({
        options: { did: 'did:foo:bar', all: true },
      })
    ).rejects.toThrow('--did and --all flags may not both be specified.');
  });
  it('should error if neither "did" nor "all" flag is provided', async () => {
    await expect(
      migrateTenantDid({
        options: {},
      })
    ).rejects.toThrow('either --did or --all flag must be specified.');
  });
  it('should error if communication with the agent fails', async () => {
    mock.method(global, 'fetch', () => {
      throw new Error('mock error');
    });
    await expect(
      migrateTenantDid({
        options: {
          did: 'did:foo:bar',
          endpoint: 'http://localhost.test',
          authToken: 'foo',
        },
      })
    ).rejects.toThrow('mock error');
  });
  it('should error if agent returns non-success http status code', async () => {
    mock.method(global, 'fetch', () => {
      return Promise.resolve(
        new Response(
          JSON.stringify({
            error: 'Bad Request',
            errorCode: 'missing_error_code',
            message: 'No tenants to refresh',
            statusCode: 400,
          }),
          { status: 400 }
        )
      );
    });
    await expect(
      migrateTenantDid({
        options: {
          did: 'did:foo:bar',
          endpoint: 'http://localhost.test',
          authToken: 'foo',
        },
      })
    ).rejects.toThrow('Response status: 400');
  });
  it('should migrate one tenant when "did" flag is specified', async () => {
    const responses = [
      [200, [{ id: 'foo', did: 'did:foo:bar' }]],
      [200, {}],
      [200, [{ id: 'foo', did: 'did:foo:ba2' }]],
    ];
    const mockFn = mock.fn(multiMockFetch(responses));
    mock.method(global, 'fetch', mockFn);
    const options = {
      did: 'did:foo:bar',
      endpoint: 'http://localhost.test',
      authToken: 'foo',
    };

    await migrateTenantDid({
      options,
    });
    expect(global.fetch.mock.calls).toHaveLength(3);
    const fullRefreshUrl = `${options.endpoint}/operator-api/v0.8/tenants/refresh`;
    const fullGetTenantsUrl = `${options.endpoint}/operator-api/v0.8/tenants`;
    const getTenantsExpectation = [
      fullGetTenantsUrl,
      {
        headers: {
          Authorization: `Bearer ${options.authToken}`,
          'Content-Type': 'application/json',
        },
        method: 'GET',
      },
    ];
    expect(global.fetch.mock.calls[0].arguments).toEqual(getTenantsExpectation);
    expect(global.fetch.mock.calls[1].arguments).toEqual([
      fullRefreshUrl,
      {
        body: JSON.stringify({ did: options.did }),
        headers: {
          Authorization: `Bearer ${options.authToken}`,
          'Content-Type': 'application/json',
        },
        method: 'POST',
      },
    ]);
    expect(global.fetch.mock.calls[2].arguments).toEqual(getTenantsExpectation);
  });
  it('should migrate all tenants when "all" flag is specified', async () => {
    const responses = [
      [200, [{ id: 'foo', did: 'did:foo:bar' }]],
      [200, {}],
      [200, [{ id: 'foo', did: 'did:foo:ba2' }]],
    ];
    const mockFn = mock.fn(multiMockFetch(responses));
    mock.method(global, 'fetch', mockFn);

    const options = {
      all: true,
      endpoint: 'http://localhost.test',
      authToken: 'foo',
    };

    await migrateTenantDid({
      options,
    });
    expect(global.fetch.mock.calls).toHaveLength(3);
    const fullRefreshUrl = `${options.endpoint}/operator-api/v0.8/tenants/refresh`;
    const fullGetTenantsUrl = `${options.endpoint}/operator-api/v0.8/tenants`;
    const getTenantsExpectation = [
      fullGetTenantsUrl,
      {
        headers: {
          Authorization: `Bearer ${options.authToken}`,
          'Content-Type': 'application/json',
        },
        method: 'GET',
      },
    ];
    expect(global.fetch.mock.calls[0].arguments).toEqual(getTenantsExpectation);
    expect(global.fetch.mock.calls[1].arguments).toEqual([
      fullRefreshUrl,
      {
        body: JSON.stringify({ all: options.all }),
        headers: {
          Authorization: `Bearer ${options.authToken}`,
          'Content-Type': 'application/json',
        },
        method: 'POST',
      },
    ]);
    expect(global.fetch.mock.calls[2].arguments).toEqual(getTenantsExpectation);
  });
});
