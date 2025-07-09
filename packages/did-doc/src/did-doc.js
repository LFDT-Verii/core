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
const {
  castArray,
  find,
  isPlainObject,
  isString,
  isEmpty,
  intersectionBy,
  last,
  compact,
  groupBy,
  concat,
  flatten,
  flow,
  includes,
  reject,
  pick,
  map,
  size,
  uniqBy,
  without,
} = require('lodash/fp');
const { toRelativeServiceId } = require('./normalize-id');

const ensurePlainObject = (obj, message) => {
  if (!isPlainObject(obj)) {
    throw newError(message, { obj });
  }
};

const ensureString = (string, message) => {
  if (!isString(string)) {
    throw newError(message, { string });
  }
};

const serviceExists = (didDoc, serviceId) => {
  const normalizedServiceId = toRelativeServiceId(serviceId);
  return find(
    (service) => toRelativeServiceId(service.id) === normalizedServiceId,
    didDoc.service
  );
};

const extractService = (didDoc, serviceId) => {
  ensurePlainObject(
    didDoc,
    'didDoc must be a type that represents an organization document'
  );

  ensureString(
    serviceId,
    'serviceId must be a string containing an organization service ID'
  );

  const existingService = serviceExists(didDoc, serviceId);

  if (!existingService) {
    throw newError(`Service with ID ${serviceId} does not exist`, {
      didDoc,
      serviceId,
    });
  }

  return existingService;
};

const createDidDoc = ({ did, services, keys, alsoKnownAs }) => {
  const verificationMethod = buildVerificationMethod(keys, did);
  const didDoc = {
    '@context': ['https://www.w3.org/ns/did/v1'],
    id: did,
    alsoKnownAs: buildAlsoKnownAs(alsoKnownAs),
    service: buildServices(services),
    verificationMethod,
    assertionMethod: buildAssertionMethod(verificationMethod),
  };
  validateDidDoc(didDoc);
  return { didDoc };
};

const addServiceToDidDoc = ({ didDoc, service }) => {
  const serviceList = flow(
    castArray,
    (services) => buildServices(services),
    concat(didDoc.service),
    compact
  )(service);
  const newDoc = {
    ...didDoc,
    service: serviceList,
  };
  validateDidDoc(newDoc);
  return { didDoc: newDoc };
};

const addKeysToDidDoc = ({ didDoc, keys }) => {
  const newVerificationMethods = buildVerificationMethod(keys, didDoc.id);
  const verificationMethod = (didDoc.verificationMethod ?? []).concat(
    newVerificationMethods
  );
  const assertionMethod = buildAssertionMethod(verificationMethod);
  const newDoc = {
    ...didDoc,
    verificationMethod,
    assertionMethod,
  };
  validateDidDoc(newDoc);
  return { didDoc: newDoc, newVerificationMethods };
};

const buildAlsoKnownAs = (alsoKnownAs) => {
  return flow(castArray, compact, (aka) => (isEmpty(aka) ? undefined : aka))(
    alsoKnownAs
  );
};

const buildServices = (services) => {
  return map(pick(['id', 'type', 'serviceEndpoint']))(services);
};

const buildVerificationMethod = (keys, did) => {
  return flow(
    map(({ id, publicKey, type = 'JsonWebKey2020' }) => {
      const prop = publicKeyTypeToProp[type];
      if (prop == null) {
        return undefined;
      }
      return {
        id,
        controller: did,
        type,
        [publicKeyTypeToProp[type]]: pick(['crv', 'x', 'y', 'kty'])(publicKey),
      };
    }),
    compact
  )(keys);
};

const buildAssertionMethod = (verificationMethods) => {
  return flow(map('id'), compact)(verificationMethods);
};

const removeKeyFromDidDoc = ({ didDoc, keyId }) => {
  const keysList = reject({ id: keyId }, didDoc.verificationMethod);
  const keyIdsList = reject((id) => {
    return id === keyId;
  }, didDoc.assertionMethod);
  const newDoc = {
    ...didDoc,
    verificationMethod: keysList,
    assertionMethod: keyIdsList,
  };
  validateDidDoc(newDoc);
  return { didDoc: newDoc };
};

const removeServiceFromDidDoc = ({ didDoc, serviceId }) => {
  const services = reject({ id: serviceId }, didDoc.service);
  const newDoc = {
    ...didDoc,
    service: services,
  };
  validateDidDoc(newDoc);
  return { didDoc: newDoc };
};

const updateServicesOnDidDoc = ({ didDoc, services }) => {
  const serviceList = flow(
    (_services) => {
      return intersectionBy('id', _services, didDoc.service);
    },
    map(pick(['id', 'type', 'serviceEndpoint'])),
    concat(didDoc.service),
    groupBy('id'),
    map(last),
    compact
  )(services);
  const newDoc = {
    ...didDoc,
    service: serviceList,
  };
  validateDidDoc(newDoc);
  return { didDoc: newDoc };
};

const validateDidDoc = (didDoc) => {
  validateId(didDoc);
  validateServices(didDoc.service);
};

const validateServices = (services) => {
  const uniqueServices = uniqBy('id', services);
  if (size(uniqueServices) !== size(services)) {
    throw new Error('DID Document services not unique');
  }
};

const validateId = (didDoc) => {
  if (!isString(didDoc.id) || isEmpty(didDoc.id)) {
    throw new Error('DID Document id is not valid');
  }
};

const publicKeyTypeToProp = {
  JsonWebKey2020: 'publicKeyJwk',
  EcdsaSecp256k1VerificationKey2019: 'publicKeyJwk',
};

const isDidMatching = (did, didDoc) => {
  return flow(getDidAndAliases, includes(did))(didDoc);
};

const getDidAndAliases = (didDoc) => {
  return flow(flatten, compact)([didDoc.id, didDoc.alsoKnownAs]);
};

const buildDidDocWithAlternativeId = (did, didDoc) => {
  const dids = getDidAndAliases(didDoc);
  const aliases = without([did], dids);
  return {
    ...didDoc,
    id: did,
    alsoKnownAs: buildAlsoKnownAs(aliases),
  };
};

module.exports = {
  addKeysToDidDoc,
  addServiceToDidDoc,
  buildDidDocWithAlternativeId,
  createDidDoc,
  extractService,
  getDidAndAliases,
  isDidMatching,
  removeKeyFromDidDoc,
  removeServiceFromDidDoc,
  serviceExists,
  updateServicesOnDidDoc,
};
