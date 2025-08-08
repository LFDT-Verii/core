const { after, afterEach, beforeEach, describe, it } = require('node:test');
const { expect } = require('expect');

const fastify = require('fastify');
const nock = require('nock');
const { oauthPlugin } = require('../src/oauth');

const noScopesToken =
  // eslint-disable-next-line max-len
  'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6IktFWSJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiYWRtaW4iOnRydWUsImlzcyI6Imh0dHBzOi8vbG9jYWxob3N0LyIsImF1ZCI6ImZvbyJ9.vnk1jg8Jf_Wazw8UHNbJ-IJWi_W7zo9UaaIQZXZzxis4Qj1d2mrsL3xHjGDCMQxYisBFvMXN40c7stWYmy3iyLKbmwad4mgmaDD27Amj1w4o6pBv-Pi6O8uIJs4wx6OksuKED3aq03LdZoxm6382nE0LefKt6TKYiKfuiz930kBFEjuo9pPkpTD94LC_0wKs8ub2PRUQSUMG8cTX8CZpsp0ipKa6KjfAgDKyNMJH8PdoKshNP2YNwgABZxZaSSQyMS6tcs1XfA4UagavDdJN-uNAtpstnVRwGtp_gSAqhYCq3_s7RU8BpEK6-RCIUdL5-V2VsfouCrQrjv8DfhH7nc_3PxDA2J1ZwZ5Sa10VcY2sxvfl0cHlvyS8BcDDeyUGIefp-vFxrqXHc5Kw6Gg7whrGYUfOw7zr7rPMSciiwpp04NsnHTZeAK_L_m_R9QlUQCi1yf6WiWvnQiwEJ2I0dIx2uomdKLr-UXYvUINtPtRoM9ScmaC8nSUo1SYxorr9Z32PWagLO0pLxAtN2BoPrmdkrgco_ICC8LnQl9Tx5VZOwc_GxeIFYFojjJkkmks4Qwx3_cJo-TaUIExX3ZZkiWE7h2YvqSrpSVYahmJedj2gFcufCJiy6hs-BKNbbxQP794DNRyOnkztY3F6ZPnG35FapJsZr8qxIvKMDrmnfCY';

const emptyScopesToken =
  // eslint-disable-next-line max-len
  'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6IktFWSJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiYWRtaW4iOnRydWUsImlzcyI6Imh0dHBzOi8vbG9jYWxob3N0LyIsImF1ZCI6ImZvbyIsInNjb3BlIjoiIn0.JqQqtEMyY_Lersvn9Or47jXOlcyc34nFitdm8fry5SDuLkq596NfZ4Q19crcLPLmdSFeY5Ljt2uc_qVX9uZqaTmCxlrMAmNJw8Y6xc_8JyWi1kKhi-Z6aX9eM8AsLTpVbFUUjWCK5MvCYs8FEXU0lc8eYPvPgjxiHdXPD9wVkbNXTEx8uHENyjloOS-InEbxp2mvKC6jvGe0I8CJ0To-UOCLco5Re4EhvsNv04wCr6ISJGLxRHp19mtygR2Pwn5vEl-4_xfjvjy1aFa2In5gZ04cLFVO0eCbXUNW23llFmGa7i5S0QWHG66_LLcCi0ArMIkWVLfnzfdzqczzUGS62weslnZRWOYG6oxt2XU77D6gXvbvVdep0g7H4nn82x7Mt1d9ToOoU6z0ERCsbK2gQ1tAj6NMJrxwAckLASljkYXMEilOUOlgzAbdKaK1wOK7Xj9nC1WiqyJHqZFqHs7vMOqGj3QaxvCMEoDCFXlIjEfVYjz3pZ_cZSfd0JVwCzMvYWHj6uufER9yYtgrizoYacN04qOrPP2NY3qhiO0yE6gY4ashOf60Iyb1RpZ2uobjhl6jYAXQYonPsO7rTnTZGuOKx24fEp5He_SKFl4Gkk8OFrEN3JC-w2cXKHWyjTotLpFyGKMOjkNPm64yl2zky22jrTq9TrBZfqM4YMBOEmc';

const scopesToken =
  // eslint-disable-next-line max-len
  'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6IktFWSJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiYWRtaW4iOnRydWUsImlzcyI6Imh0dHBzOi8vbG9jYWxob3N0LyIsImF1ZCI6ImZvbyIsInNjb3BlIjoicmVhZDp1c2VycyJ9.VwIIUqx9T-AxqbfL_FyNRAeOxTwiC2JpcwtrqnEWN3DdF07ijUkF1WYy8Ahfr_p4R3KnoPbiefZnIbVANCt-lt0ej32rfil2yHhQEsvFxSOjcrx6ARmPp0YAfWlN-5Sotzkxy29jaOZMEDkmRFZg3jkdC7wosPW_S6M-olC4g3HHfylpZI8O3Jdd87Qr9wD_QtUzANwnPbl2Q-9NEyxVjAZIWg_HWK9JAAaf_2IY5VwHBvyp0oeQSEHKi4hogcM59EOc4FxdR5WH45B_PenVa6W4mHFBkH8sAXxt2Zs9s2efujkfWYfyXvgL_lN7vT-TEADlAPP2L6CpWpDISOMsQWUSgGHcN_KwRh_E7qJwahR6mv4QHY6ReEoyjkmSS3swrD1l74jNs7QLAdsMywvzCMDsHabs7DYcEMGQBdP14PJ_ucLFnkivZeBDAc6sS445ocbyrpyO40XMaMorD5khRd9ej89SxR7d_v0W6Ne2Nn4XgW3pAZzu5Rdc4JvqfzLFxkp95jxy1MTAddjWISPmNOYYyXHM9SSqSpqVECOFS0f4z2zycHRqXUcOytWrvED6VGo9x7-IVCgu8vFzj0zToIWQmsDs3UoH9RnV12z0PMwGXQzca1lT_zGwJxBF3e4zJjmcJ05OMF2JgZ2_G48O3M4Dtb0jlgWbKLd0kWlIFzQ';

const jwks = {
  keys: [
    {
      alg: 'RS512',
      kid: 'KEY',
      x5c: ['UNUSED'],
    },
    {
      alg: 'RS256',
      kid: 'KEY',
      x5c: [
        `
MIIEnjCCAoYCCQDmnGII6qzGlTANBgkqhkiG9w0BAQsFADARMQ8wDQYDVQQDDAZ1
bnVzZWQwHhcNMjEwOTE5MDcxODQ2WhcNMjExMDE5MDcxODQ2WjARMQ8wDQYDVQQD
DAZ1bnVzZWQwggIiMA0GCSqGSIb3DQEBAQUAA4ICDwAwggIKAoICAQDY2acJ8JAH
XjK8j3sAXOokSWwvaEg65UJS0C7KdnfbLTeaeYFHBRY0v9Jkk/PJSXv9hMWw1aD3
n7NrhVwXeRXi/7VZuW/S4ek+hK+IMDvpKqzn+XeCpaMoRpAgloADeNY0qhYKxpr2
L0SmRQDwVy1r/g31ECewD2WpEiRSmXsQ2Q2uYT3V60BmbhUw31KGEr4SLXL9pzmb
arOH/5Rhqg+YFMywNY6i01S3UdOlUtAyWT/mVRAkVTsUEou9tBw61zputPdMrl7p
d4InmlfCmXNTPFh9EDczPQiAVPq8MDyEdRGP134+HM9+YgQUZjy+WsxmGEvplJIf
KrYtlWe11//oAXC3690LUYtvg49lNY4+H0/nngjnCDXkZo6f+PEvnBZfYl596VTV
Fx4FGNOqLwg4bAyE5j5jXtEGW1oKo1pxBg7Oe3MteQUDwMrONB3CbxdxDiN3YH94
2nWGW9Le+CeA1QUhfjQqSoZRJURGYGoztVuIXOElnkrgwcJreX4b8y+Uo5kpp2By
6UUaD/mMj9XQ+Ygp/J8DlJlqDXOIp6JUJ75aSK5ZIjRtWq/Go5RUjW9IW0ldEehh
/4j0ZWC0vR1/le2UmAE6tXhkH4sdx9JM84V+qRzjiGqQx3Wn00uwMiHHhte17t41
vk+b75wuHbfiq9R8irL6wqWeeuzvCC37NwIDAQABMA0GCSqGSIb3DQEBCwUAA4IC
AQCZOT6S5HLUp0gBtWK6Fxyzb9lWPE+AJipjJ80lS3OnaOIyVtyJexJ2BjTKWldJ
48zkzLNIRsTEGEipNS6NkrkElfmoaNBpdbDch2WBkME3UYlFIR9GgbXPMlACQlwJ
f4qT3iIZ9zjpVMP8F63TzRRr7KEYW2PGHEtVQktMPprGEfU4Sz0OIa9RRV+BLsfh
x8he2pimJEzoEaWPgyJXV1S+tLUif8A/CEkZVRZ2vADA7WMGl2ZTdbmsTjXh4bf2
A4l4Zec+jwOjUPiEk5lLJwv1KeYos9wuUczAk7ku8wRzyZbrjwgRam9VQA5qmRzJ
PegEQwJaKMRu8PPK0L4KFN4v3ma7Ux6D719nko8mZ0kA2oUs6phsFmoWQfsbRbsD
CdUGnM2fPp6V285r9w9Y6+1nVdtJpbAPFJR3SxIpfYVfx3tI6C3BR9bIMr8uCf81
G+Ebvo4qTuY6Cg/mTpPLZ4cKpwSvB6cE+xeSHvKIRYm6QUYEReRxQ3b4aUKBSNwl
FEQufVGhGzeblNC3fjP+mMtqbyC8c1zkHc6tjJYO5yesKf8bjO71by2jgSced7nN
5JvJawfEcabgHJ1aAFLj0tlPMrViFzu6y8/A5aZLc5UMISXAZXfB4wIEdyUUXJh4
rJKE/ZCb2+W8g29N5cv2P6nhahT3mYatMiQ0U/gfaIrA0A==
        `.trim(),
      ],
    },
  ],
};

describe('oauth module', () => {
  let server;

  beforeEach(() => {
    nock.cleanAll();
    nock.disableNetConnect();
    nock('https://localhost/').get('/.well-known/jwks.json').reply(200, jwks);
    server = fastify({});
  });

  afterEach(async () => {
    await server.close();
  });

  after(() => {
    nock.cleanAll();
    nock.enableNetConnect();
    nock.restore();
  });

  it('the verifyAccessToken should return 200 if no scope token and no scopes required', async () => {
    server
      .register(oauthPlugin, {
        domain: 'https://localhost/',
        audience: 'foo',
      })
      .register(async (instance) => {
        instance.get(
          '/',
          {
            onRequest: instance.verifyAccessToken([]),
          },
          async () => 'OK'
        );
      });

    await server.ready();

    const response = await server.inject({
      method: 'GET',
      url: '/',
      headers: {
        authorization: `Bearer ${noScopesToken}`,
      },
    });

    expect(response.statusCode).toEqual(200);
  });

  it('the verifyAccessToken should return 403 if no scope token but scopes required', async () => {
    server
      .register(oauthPlugin, {
        domain: 'https://localhost/',
        audience: 'foo',
      })
      .register(async (instance) => {
        instance.get(
          '/',
          {
            onRequest: instance.verifyAccessToken(['read:users']),
          },
          async () => 'OK'
        );
      });

    await server.ready();

    const response = await server.inject({
      method: 'GET',
      url: '/',
      headers: {
        authorization: `Bearer ${noScopesToken}`,
      },
    });

    expect(response.statusCode).toEqual(403);
  });

  it('the verifyAccessToken should return 200 if empty scope token and no scopes required', async () => {
    server
      .register(oauthPlugin, {
        domain: 'https://localhost/',
        audience: 'foo',
      })
      .register(async (instance) => {
        instance.get(
          '/',
          {
            onRequest: instance.verifyAccessToken([]),
          },
          async () => 'OK'
        );
      });

    await server.ready();

    const response = await server.inject({
      method: 'GET',
      url: '/',
      headers: {
        authorization: `Bearer ${emptyScopesToken}`,
      },
    });

    expect(response.statusCode).toEqual(200);
  });

  it('the verifyAccessToken should return 403 if empty scope token but scopes required', async () => {
    server
      .register(oauthPlugin, {
        domain: 'https://localhost/',
        audience: 'foo',
      })
      .register(async (instance) => {
        instance.get(
          '/',
          {
            onRequest: instance.verifyAccessToken(['read:users']),
          },
          async () => 'OK'
        );
      });

    await server.ready();

    const response = await server.inject({
      method: 'GET',
      url: '/',
      headers: {
        authorization: `Bearer ${emptyScopesToken}`,
      },
    });

    expect(response.statusCode).toEqual(403);
  });

  it('the verifyAccessToken should return 200 if scopes match', async () => {
    server
      .register(oauthPlugin, {
        domain: 'https://localhost/',
        audience: 'foo',
      })
      .register(async (instance) => {
        instance.get(
          '/',
          {
            onRequest: instance.verifyAccessToken([
              'admin:users',
              'read:users',
            ]),
          },
          async () => 'OK'
        );
      });

    await server.ready();

    const response = await server.inject({
      method: 'GET',
      url: '/',
      headers: {
        authorization: `Bearer ${scopesToken}`,
      },
    });

    expect(response.statusCode).toEqual(200);
  });

  it("the verifyAccessToken should return 403 if scopes don't match", async () => {
    server
      .register(oauthPlugin, {
        domain: 'https://localhost/',
        audience: 'foo',
      })
      .register(async (instance) => {
        instance.get(
          '/',
          {
            onRequest: instance.verifyAccessToken(['write:users']),
          },
          async () => 'OK'
        );
      });

    await server.ready();

    const response = await server.inject({
      method: 'GET',
      url: '/',
      headers: {
        authorization: `Bearer ${scopesToken}`,
      },
    });

    expect(response.statusCode).toEqual(403);
  });
});
