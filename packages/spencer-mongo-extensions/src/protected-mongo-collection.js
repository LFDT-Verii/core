/**
 * Copyright 2023 Velocity Team
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
 */

const newError = require('http-errors');
const { isEmpty, get, set, flow, map } = require('lodash/fp');
const { decryptCollection, encryptCollection } = require('@verii/crypto');

const encryptSecret = ({ value, context, secretPropName, format }) => {
  if (isEmpty(get(secretPropName, value))) {
    return value;
  }

  return flow(
    get(secretPropName),
    (secret) => {
      const serializedValue =
        format === 'jwk' ? JSON.stringify(secret) : secret;
      return encryptCollection(serializedValue, context.config.mongoSecret);
    },
    (secret) => set(secretPropName, secret, value),
  )(value);
};

const initFindOneAndDecryptSecret =
  ({
    parent,
    context,
    itemType,
    defaultProjection,
    secretPropName = 'key',
    format = 'jwk',
  }) =>
  async ({ filter }, projection) => {
    const projectionToUse = projection || defaultProjection;
    const item = await parent.findOne({ filter }, projectionToUse);
    if (item == null) {
      throw newError(
        404,
        `No ${itemType} matching the filter ${JSON.stringify(filter)} was found`,
      );
    }
    const secretValue = get(secretPropName, item);
    if (secretValue == null) {
      throw newError(
        500,
        `No ${secretPropName} set on ${itemType} matching the filter ${JSON.stringify(
          filter,
        )}`,
      );
    }
    let decryptedValue = decryptCollection(
      secretValue,
      context.config.mongoSecret,
    );
    if (format === 'jwk') {
      decryptedValue = JSON.parse(decryptedValue);
    }
    const decryptedItem = set(secretPropName, decryptedValue, item);
    return decryptedItem;
  };

const initFindAndDecryptSecret =
  ({
    parent,
    context,
    itemType,
    defaultProjection,
    secretPropName = 'key',
    format = 'jwk',
  }) =>
  async ({ filter }, projection) => {
    const projectionToUse = projection || defaultProjection;
    const items = await parent.find({ filter }, projectionToUse);
    if (isEmpty(items)) {
      return [];
    }
    return map((item) => {
      const secretValue = get(secretPropName, item);
      if (secretValue == null) {
        throw newError(
          500,
          `No ${secretPropName} set on ${itemType} matching the filter ${JSON.stringify(
            filter,
          )}`,
          { errorCode: 'tenant_exchanges_key_missing' },
        );
      }
      let decryptedValue = decryptCollection(
        secretValue,
        context.config.mongoSecret,
      );
      if (format === 'jwk') {
        decryptedValue = JSON.parse(decryptedValue);
      }
      return set(secretPropName, decryptedValue, item);
    }, items);
  };

const initPrepModification =
  ({ parent, context, secretPropName = 'key', format = 'jwk' }) =>
  (value, ...args) => {
    const encryptedValue = encryptSecret({
      value,
      context,
      secretPropName,
      format,
    });
    return parent.prepModification(encryptedValue, ...args);
  };

module.exports = {
  initFindOneAndDecryptSecret,
  initPrepModification,
  initFindAndDecryptSecret,
};
