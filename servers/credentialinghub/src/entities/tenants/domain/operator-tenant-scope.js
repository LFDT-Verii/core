/*
 * Copyright 2026 Velocity Team
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

const CAO_DID_MISMATCH = 'cao_did_mismatch';

const getOperatorCaoDid = (context) =>
  context.operatorPrincipal?.caoDid ?? null;

const scopeTenantFilter = (filter, context) => {
  const caoDid = getOperatorCaoDid(context);
  return caoDid == null ? filter : { ...filter, caoDid };
};

const applyOperatorCaoDid = (newTenant, context) => {
  const caoDid = getOperatorCaoDid(context);
  if (
    caoDid != null &&
    newTenant.caoDid != null &&
    newTenant.caoDid !== caoDid
  ) {
    throw newError(400, CAO_DID_MISMATCH, {
      errorCode: CAO_DID_MISMATCH,
    });
  }
  return caoDid == null ? { ...newTenant } : { ...newTenant, caoDid };
};

module.exports = {
  applyOperatorCaoDid,
  getOperatorCaoDid,
  scopeTenantFilter,
};
