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

const { getRevocationRegistry } = require('./get-revocation-registry');

/** @import { Issuer, Context } from "../../types/types" */

/**
 * Revocation list entries contract services
 * @param {number} listId the list number to create
 * @param {Issuer} issuer the issuer
 * @param {Context }context the context
 */
const createRevocationList = async (listId, issuer, context) => {
  const { caoDid } = context;
  const revocationRegistry = await getRevocationRegistry(issuer, context);
  try {
    await revocationRegistry.addRevocationListSigned(listId, caoDid);
  } catch (err) {
    await revocationRegistry.addWalletToRegistrySigned({ caoDid });
    await revocationRegistry.addRevocationListSigned(listId, caoDid);
  }
};

module.exports = { createRevocationList };
