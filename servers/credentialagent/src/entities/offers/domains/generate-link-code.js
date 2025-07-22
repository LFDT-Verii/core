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
  generateRandomBytes,
  createCommitment,
} = require('@verii/crypto');

const LINK_CODE_BIT_LENGTH = 160;
const LINK_CODE_BYTE_LENGTH = LINK_CODE_BIT_LENGTH / 8;

const generateLinkCode = () => {
  const linkCodeBytes = generateRandomBytes(LINK_CODE_BYTE_LENGTH);
  const linkCodeCommit = createCommitment(linkCodeBytes);

  return {
    linkCodeCommitment: {
      type: 'VelocityCredentialLinkCodeCommitment2022',
      value: linkCodeCommit,
    },
    linkCode: linkCodeBytes.toString('base64'),
  };
};

module.exports = { generateLinkCode };
