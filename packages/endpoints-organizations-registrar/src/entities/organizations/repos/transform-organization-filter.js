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

const { flow, isEmpty, omit, partition } = require('lodash/fp');
const {
  ServiceCategories,
  ServiceTypesOfServiceCategory,
} = require('@verii/organizations-registry');
const { initTransformToFinder } = require('@verii/rest-queries');
const { tableRegistry } = require('@spencejs/spence-mongo-repos');
const {
  getServiceTypesFromCategories,
} = require('../../organization-services/domains');

const ISSUER_SERVICE_TYPES =
  ServiceTypesOfServiceCategory[ServiceCategories.Issuer];

const transformServiceTypeFilter = (input) => {
  const serviceTypes = getServiceTypesFromCategories(input);
  return input?.filter?.serviceTypes == null
    ? input
    : {
        ...input,
        filter: {
          ...omit(['serviceTypes', 'credentialTypes'], input.filter),
          services: {
            $elemMatch: buildRegistrarServiceElemMatch(input, serviceTypes),
          },
        },
      };
};

const transformIdFilter = (input) =>
  input?.filter?.did == null
    ? input
    : {
        ...input,
        filter: {
          ...omit(['did'], input.filter),
          'didDoc.id': { $in: input.filter.did },
        },
      };
const buildRegistrarServiceElemMatch = (input, serviceTypes) => {
  const [issuerServiceTypes, nonIssuerServiceTypes] = partition(
    (s) => ISSUER_SERVICE_TYPES.includes(s),
    serviceTypes
  );

  if (isEmpty(issuerServiceTypes)) {
    return {
      type: {
        $in: nonIssuerServiceTypes,
      },
    };
  }

  if (isEmpty(input?.filter?.credentialTypes)) {
    return {
      type: {
        $in: serviceTypes,
      },
    };
  }

  return {
    $or: [
      {
        type: {
          $in: issuerServiceTypes,
        },
        credentialTypes: {
          $elemMatch: { $in: input.filter.credentialTypes },
        },
      },
      {
        type: {
          $in: nonIssuerServiceTypes,
        },
      },
    ],
  };
};

const initTransformOrganizationFilter = () =>
  initTransformToFinder(tableRegistry.organizations(), {
    transformToFilterDocument: flow(
      transformIdFilter,
      transformServiceTypeFilter
    ),
  });

module.exports = { initTransformOrganizationFilter };
