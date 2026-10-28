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
 *
 */

const { mongoDb } = require('@spencejs/spence-mongo-repos');
const { ObjectId } = require('mongodb');

// A null caoDid removes the field, as on a legacy tenant created without one.
const setTenantCaoDid = (tenant, caoDid) =>
  mongoDb()
    .collection('tenants')
    .updateOne(
      { _id: new ObjectId(tenant._id) },
      caoDid == null ? { $unset: { caoDid: '' } } : { $set: { caoDid } },
    );

module.exports = { setTenantCaoDid };
