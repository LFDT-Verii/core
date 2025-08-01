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

const ethUrlParser = require('eth-url-parser');

const REVOCATION_STATUS_CONTRACT_FUNCTION_NAME = 'getRevokedStatus';

/** @import { Issuer, AllocationListEntry, Context } from "../../types/types" */

/**
 * Builds a revocation url
 * @param {AllocationListEntry} entry the dlt list entry
 * @param {Issuer} issuer the issuer
 * @param {Context} context the context
 * @returns {string} the revocation url
 */
const buildRevocationUrl = (
  entry,
  issuer,
  { config: { revocationContractAddress } }
) =>
  ethUrlParser.build({
    scheme: 'ethereum',
    target_address: revocationContractAddress,
    function_name: REVOCATION_STATUS_CONTRACT_FUNCTION_NAME,
    parameters: {
      address: issuer.dltPrimaryAddress,
      listId: entry.listId,
      index: entry.index,
    },
  });

module.exports = { buildRevocationUrl };
