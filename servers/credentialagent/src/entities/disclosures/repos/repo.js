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

const {
  repoFactory,
  autoboxIdsExtension,
} = require('@spencejs/spence-mongo-repos');
const { multitenantExtension } = require('@verii/spencer-mongo-extensions');
const { ObjectId } = require('mongodb');
const newError = require('http-errors');
const {
  VendorEndpoint,
  identificationMethodsIncludesPreauth,
} = require('../domains');
const { setConfigurationType } = require('./set-configuration-type');

module.exports = (app, options, next = () => {}) => {
  next();
  return repoFactory(
    {
      name: 'disclosures',
      entityName: 'disclosure',
      defaultProjection,
      extensions: [
        autoboxIdsExtension,
        multitenantExtension(),
        disclosureExtensions,
        setConfigurationType,
      ],
    },
    app,
  );
};

const defaultProjection = {
  _id: 1,
  description: 1,
  feed: 1,
  types: 1,
  presentationDefinition: 1,
  identificationMethods: 1,
  vendorEndpoint: 1,
  identityMatchers: 1,
  vendorOrganizationId: 1,
  vendorDisclosureId: 1,
  purpose: 1,
  duration: 1,
  termsUrl: 1,
  deactivationDate: 1,
  createdAt: 1,
  updatedAt: 1,
  sendPushOnVerification: 1,
  offerMode: 1,
  configurationType: 1,
  commercialEntityName: 1,
  commercialEntityLogo: 1,
  authTokensExpireIn: 1,
};

const disclosureExtensions = (parent) => ({
  findDefaultIssuingDisclosure: (opts) =>
    parent.findOne(
      {
        filter: {
          vendorEndpoint: {
            $in: [
              VendorEndpoint.ISSUING_IDENTIFICATION,
              VendorEndpoint.INTEGRATED_ISSUING_IDENTIFICATION,
            ],
          },
        },
      },
      opts,
    ),
  updateDisclosure: async ({ id, body }) => {
    const updateDoc = {
      $set: { ...body, updatedAt: new Date() },
      $unset: buildUpdateUnsetDocument(body),
    };
    const filter = parent.prepFilter({ _id: new ObjectId(id) });
    const updateResult = await parent
      .collection()
      .findOneAndUpdate(filter, updateDoc, {
        projection: defaultProjection,
        returnDocument: 'after',
        includeResultMetadata: true,
      });
    if (!updateResult.value) {
      throw newError(404, `disclosure ${id} not found`, {
        errorCode: 'disclosure_not_found',
      });
    }
    return updateResult.value;
  },
});

const buildUpdateUnsetDocument = (body) => {
  if (identificationMethodsIncludesPreauth(body.identificationMethods)) {
    return { types: '', presentationDefinition: '' };
  }
  if (body.presentationDefinition != null) {
    return { types: '' };
  }
  return { presentationDefinition: '' };
};
