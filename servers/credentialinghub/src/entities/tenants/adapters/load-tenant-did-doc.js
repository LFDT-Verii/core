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

const { resolveDid } = require('@verii/common-fetchers');
const newError = require('http-errors');
const { isEmpty } = require('lodash/fp');
const { TenantErrors } = require('../domain/tenant-errors');

const loadTenantDidDoc = async (did, context) => {
  const didDoc = await resolveDidWithErrorHandling(
    did,
    TenantErrors.DID_DOCUMENT_NOT_FOUND,
    context,
  );
  if (isEmpty(didDoc)) {
    context.log.error('Tenant DID Document is null or {}');
    throw newError(400, TenantErrors.DID_DOCUMENT_NOT_FOUND, {
      errorCode: TenantErrors.DID_DOCUMENT_NOT_FOUND,
    });
  }
  return didDoc;
};

const resolveDidWithErrorHandling = async (did, errorCode, context) => {
  try {
    return await resolveDid(did, context);
  } catch (error) {
    context.log.error(error, 'Error retrieving DID Document');
    throw newError(400, errorCode, { errorCode });
  }
};

module.exports = { loadTenantDidDoc };
