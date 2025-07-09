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

const { last, split, startsWith, map } = require('lodash/fp');

const toRelativeServiceId = (serviceId) => {
  if (startsWith('#', serviceId)) {
    return serviceId;
  }
  if (!serviceId.includes('#')) {
    return `#${serviceId}`;
  }
  return `#${last(split('#', serviceId))}`;
};

const toRelativeKeyId = (keyId) => toRelativeServiceId(keyId);

const toDidUrl = (did, relativeId) => {
  if (did == null || relativeId == null) {
    return '';
  }

  if (startsWith('did:', relativeId)) {
    return relativeId;
  }

  return relativeId.startsWith('#')
    ? `${did}${relativeId}`
    : `${did}#${relativeId}`;
};

const normalizeOrganizationDidDocService = (service) => {
  return {
    id: toRelativeServiceId(service.id),
    type: service.type,
    serviceEndpoint: service.serviceEndpoint,
  };
};

const normalizeOrganizationKey = (key) => {
  return {
    ...key,
    id: toRelativeKeyId(key.id),
  };
};

const normalizeDidDoc = (didDoc) => {
  return {
    ...didDoc,
    service: map(normalizeOrganizationDidDocService, didDoc.service),
  };
};

module.exports = {
  normalizeOrganizationKey,
  normalizeOrganizationDidDocService,
  normalizeDidDoc,
  toRelativeServiceId,
  toRelativeKeyId,
  toDidUrl,
};
