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

const { VeriiProtocolVersions } = require('./verii-protocol-versions');
const { CredentialDataModelVersions } = require('@verii/jwt');
const { CheckResults } = require('./check-results');

const checkHolder = (
  dataModelVersion,
  credential,
  expectedHolderDid,
  { log },
) => {
  const {
    vnfProtocolVersion = VeriiProtocolVersions.PROTOCOL_VERSION_1,
    credentialSubject,
  } = credential;
  if (!isHolderCheckRequired(dataModelVersion, vnfProtocolVersion)) {
    return CheckResults.NOT_APPLICABLE;
  }

  const credentialSubjectIds = subjectIdsFrom(credentialSubject);
  if (
    expectedHolderDid == null ||
    !credentialSubjectIds.includes(expectedHolderDid)
  ) {
    log.error(
      { credentialSubjectIds, expectedHolderDid },
      'holder check failed',
    );
    return CheckResults.FAIL;
  }
  return CheckResults.PASS;
};

const isHolderCheckRequired = (dataModelVersion, vnfProtocolVersion) =>
  dataModelVersion === CredentialDataModelVersions.V2_0 ||
  vnfProtocolVersion >= VeriiProtocolVersions.PROTOCOL_VERSION_2;

const subjectIdsFrom = (credentialSubject) =>
  (Array.isArray(credentialSubject)
    ? credentialSubject
    : [credentialSubject]
  ).flatMap((subject) => (typeof subject?.id === 'string' ? [subject.id] : []));

module.exports = { checkHolder };
