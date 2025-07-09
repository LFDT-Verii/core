/*
 * Copyright 2025 Velocity Team
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 */
/**
 * @import { JsonWebKey } from "crypto"
 * @import { FastifyInstance } from "fastify"
 * @import { ObjectId } from "mongodb"
 * @import { Context, Id, KMS, KeySpec, KmsKey, KmsSecret, ImportableKey, ImportableSecret } from "../../types/types"
 */

const { generateJWAKeyPair } = require('@verii/crypto');
const { jwtSign, jwtVerify } = require('@verii/jwt');
const { isEmpty, omit } = require('lodash/fp');
const kmsRepo = require('./repo');
const { defaultRepoOptions } = require('./default-repo-options');

/**
 * Initializes the KMS
 * @param { FastifyInstance } fastify the fastify instance
 * @param {Record<string, string>} kmsOptions kms options
 * @returns {(Context) => KMS} a function that returns a KMS instance of the request
 */
const initDbKms = (fastify, kmsOptions = {}) => {
  const repoOptions = {
    ...defaultRepoOptions,
    ...omit(['transformToKmsKey'], kmsOptions),
  };
  const createRequestRepo = kmsRepo(fastify, repoOptions);
  const transformToKmsKey =
    kmsOptions.transformToKmsKey ?? defaultTransformToKmsKey;

  return (context) => {
    const repo = createRequestRepo(context);

    /**
     * Creates a key as per the spec
     * @param { KeySpec } kmsSpec the kms Spec
     * @returns {Promise<KmsKey>} the kms key
     */
    const createKey = async ({ algorithm = 'ec', curve }) => {
      const keyPair = generateJWAKeyPair({ algorithm, curve });
      const kmsKey = await repo.insert({
        [repoOptions.keyProp]: keyPair.privateKey,
        [repoOptions.publicKeyProp]: keyPair.publicKey,
        algorithm,
        curve,
      });
      return transformToKmsKey(kmsKey);
    };

    /**
     * Imports a key
     * @param {ImportableKey} the import key
     * @returns {Promise<KmsKey>} the kms key
     */
    const importKey = async ({
      privateKey,
      publicKey,
      algorithm,
      curve,
      ...rest
    }) => {
      const kmsKey = await repo.insert({
        [repoOptions.keyProp]: privateKey,
        [repoOptions.publicKeyProp]: publicKey,
        algorithm,
        curve,
        ...rest,
      });
      return transformToKmsKey(kmsKey);
    };

    /**
     * Imports a secret
     * @param {ImportableSecret} the import secret
     * @returns {Promise<KmsSecret>} the kms key
     */
    const importSecret = async ({ secret }) => {
      const kmsSecret = await repo.insert({
        secret,
      });
      return transformToKmsKey(kmsSecret);
    };

    /**
     * The key to load internally
     * @param {Id} keyId the key id to load
     * @returns {Promise<KeySpec & { _id: Id, privateJwk: JsonWebKey, secret: string }>} the key returned
     */
    const loadKey = (keyId) =>
      repo.findOneAndDecrypt(
        { filter: { _id: keyId } },
        {
          algorithm: 1,
          curve: 1,
          [repoOptions.keyProp]: 1,
          [repoOptions.secretProp]: 1,
        }
      );

    /**
     * The key to export
     * @param {Id} keyId the key id to load
     * @returns {Promise<KmsKey & {privateJwk: JsonWebKey, secret: string}>} the key returned
     */
    const exportKeyOrSecret = async (keyId) => {
      const dbEntity = await repo.findOneAndDecrypt(
        {
          filter: { _id: keyId },
        },
        {
          ...repo.defaultColumnsSelection,
          [repoOptions.keyProp]: 1,
          [repoOptions.secretProp]: 1,
        }
      );
      if (isEmpty(dbEntity)) {
        return null;
      }
      return transformToKmsKey(dbEntity);
    };

    /**
     * Sign a payload as a JWT
     * @param {Record<string, unknown>} payload the payload to sign
     * @param {Id} keyId the key id to sign with
     * @param {Record<string, string|number>} options the options to use for signing
     * @returns {string} a compact JWT
     */
    const signJwt = async (payload, keyId, options) => {
      const key = await loadKey(keyId);
      return jwtSign(
        payload,
        key[repoOptions.secretProp] ?? key[repoOptions.keyProp],
        options
      );
    };

    /**
     * Verify a JWT
     * @param {string} jwt the jwt to verify
     * @param {Id} keyId the key id to verify with
     * @param {Record<string, string>} options the options to use for verifying
     * @returns {{payload: Record<string, unknown>, headers: Record<string, string>}} a decoded JWT
     */
    const verifyJwt = async (jwt, keyId, options) => {
      const key = await loadKey(keyId);
      return jwtVerify(
        jwt,
        key[repoOptions.secretProp] ?? key[repoOptions.keyProp],
        options
      );
    };

    return {
      createKey,
      importKey,
      importSecret,
      exportKeyOrSecret,
      signJwt,
      verifyJwt,
    };
  };
};

/**
 * Returns a KmsKey or KmsSecret
 * @template {(KmsKey | KmsSecret)} T
 * @param {T & {_id: ObjectId}} result object
 * @returns {T} a KmsKey
 */
const defaultTransformToKmsKey = (result) => {
  /* eslint-disable better-mutation/no-mutation */
  result.id = result._id.toString();
  result._id = undefined;
  return result;
  /* eslint-enable */
};

module.exports = { initDbKms };
