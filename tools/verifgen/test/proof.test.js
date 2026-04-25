const { afterEach, beforeEach, describe, it } = require('node:test');
const { expect } = require('expect');

const fs = require('fs').promises;
const os = require('os');
const path = require('path');

const { generateKeyPair } = require('@verii/crypto');
const { jwtVerify, jwkFromSecp256k1Key } = require('@verii/jwt');
const { getDidUriFromJwk } = require('@verii/did-doc');
const { generateProof } = require('../src/verifgen-proof/generate-proof');

const createPersona = async (testDir, name, body) => {
  await fs.writeFile(path.join(testDir, `${name}.prv.key`), body);
  await fs.writeFile(path.join(testDir, `${name}.did`), JSON.stringify({}));
};

const createJwkPersona = async (testDir, name, privateKey) => {
  await fs.writeFile(
    path.join(testDir, `${name}.prv.key.json`),
    JSON.stringify(privateKey),
  );
  await fs.writeFile(path.join(testDir, `${name}.did`), JSON.stringify({}));
};

describe('Test proof cli tool', () => {
  let keyPair;
  let originalCwd;
  let testDir;

  beforeEach(async () => {
    originalCwd = process.cwd();
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'verifgen-proof-test-'));
    process.chdir(testDir);
    keyPair = await generateKeyPair();
    await createPersona(testDir, 'persona1', keyPair.privateKey);
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    await fs.rm(testDir, { recursive: true, force: true });
  });

  it('should not generate a proof if persona is missing', async () => {
    expect(() =>
      generateProof({
        challenge: 'abc',
        persona: 'not-exist',
        audience: 'http://test.com',
      }),
    ).rejects.toThrow('Persona not-exist DID File not found');
  });

  it('should generate a proof by a prv.key', async () => {
    JSON.stringify(keyPair.privateKey);
    const proof = await generateProof({
      challenge: 'abc',
      persona: 'persona1',
      audience: 'http://test.com',
    });
    expect(proof).toBeDefined();
    await expect(
      fs.access(path.join(testDir, 'proof.jwt')),
    ).resolves.toBeUndefined();
    const parsedJwt = await jwtVerify(
      proof,
      jwkFromSecp256k1Key(keyPair.publicKey, false),
    );
    const expectedKid = getDidUriFromJwk(
      jwkFromSecp256k1Key(keyPair.publicKey, false),
    );
    expect(parsedJwt).toStrictEqual({
      header: {
        alg: 'ES256K',
        typ: 'JWT',
        kid: `${expectedKid}#0`,
      },
      payload: {
        aud: 'http://test.com',
        iat: expect.any(Number),
        iss: expectedKid,
        nonce: 'abc',
      },
    });
  });

  it('should generate a proof by a prv.key.json', async () => {
    const persona2Keypair = await generateKeyPair({ format: 'jwk' });
    await createJwkPersona(testDir, 'persona2', persona2Keypair.privateKey);
    const proof = await generateProof({
      challenge: 'abc',
      persona: 'persona2',
      audience: 'http://test.com',
    });
    expect(proof).toBeDefined();
    const parsedJwt = await jwtVerify(proof, persona2Keypair.publicKey);
    const expectedKid = getDidUriFromJwk(persona2Keypair.publicKey);
    expect(parsedJwt).toStrictEqual({
      header: {
        alg: 'ES256K',
        typ: 'JWT',
        kid: `${expectedKid}#0`,
      },
      payload: {
        aud: 'http://test.com',
        iat: expect.any(Number),
        iss: expectedKid,
        nonce: 'abc',
      },
    });
  });

  it('should generate an openid4vci proof by a prv.key.json', async () => {
    const persona2Keypair = await generateKeyPair({ format: 'jwk' });
    await createJwkPersona(testDir, 'persona2', persona2Keypair.privateKey);
    const proof = await generateProof({
      challenge: 'abc',
      persona: 'persona2',
      audience: 'http://test.com',
      openid4vci: true,
    });
    expect(proof).toBeDefined();
    const parsedJwt = await jwtVerify(proof, persona2Keypair.publicKey);
    const expectedKid = getDidUriFromJwk(persona2Keypair.publicKey);
    expect(parsedJwt).toStrictEqual({
      header: {
        alg: 'ES256K',
        typ: 'openid4vci-proof+jwt',
        kid: `${expectedKid}#0`,
      },
      payload: {
        aud: 'http://test.com',
        iat: expect.any(Number),
        iss: expectedKid,
        nonce: 'abc',
      },
    });
  });
});
