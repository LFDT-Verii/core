/*
 * Copyright 2024 Velocity Team
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

const { get, isEqual, isEmpty, omit } = require('lodash/fp');
const { set } = require('lodash');
const { encryptCollection, decryptCollection } = require('@verii/crypto');

const initEncryptPropExtension = ({
  prop,
  encryptedProp,
  secret,
  format = 'string',
} = {}) => {
  const encryptProp = (obj) => {
    const value = get(prop, obj);
    if (isEmpty(value)) {
      return obj;
    }

    const serializedValue = format === 'json' ? JSON.stringify(value) : value;
    const encryptedValue = encryptCollection(serializedValue, secret);
    return replaceProp(obj, prop, encryptedProp, encryptedValue);
  };

  const decryptProp = (obj) => {
    if (obj == null) {
      return obj;
    }

    const value = get(encryptedProp, obj);
    if (isEmpty(value)) {
      return obj;
    }
    const decryptedString = decryptCollection(value, secret);
    const decryptedValue =
      format === 'json' ? JSON.parse(decryptedString) : decryptedString;
    return replaceProp(obj, encryptedProp, prop, decryptedValue);
  };

  const convertProjection = (requestedProjection) => {
    if (requestedProjection == null || requestedProjection[prop] !== 1) {
      return requestedProjection;
    }
    const projection = { ...requestedProjection, [encryptedProp]: 1 };
    if (!isEqual(encryptedProp, prop)) {
      delete projection[prop];
    }
    return projection;
  };

  return (parent) => ({
    prepModification: (rawVal, ...args) => {
      const val = encryptProp(rawVal);
      return parent.prepModification(val, ...args);
    },
    insert: async (value, requestedProjection) => {
      const insertedVal = await parent.insert(
        value,
        convertProjection(requestedProjection)
      );
      return decryptProp(insertedVal);
    },
    findOneAndDecrypt: async (query, requestedProjection) => {
      const projection = convertProjection(requestedProjection);
      const val =
        parent.findOneAndDecrypt != null
          ? await parent.findOneAndDecrypt(query, projection)
          : await parent.findOne(query, projection);
      return decryptProp(val);
    },
  });
};

const replaceProp = (obj, unsetProp, setProp, setValue) => {
  const clone = omit([unsetProp], obj);
  return set(clone, setProp, setValue);
};

module.exports = {
  initEncryptPropExtension,
};
