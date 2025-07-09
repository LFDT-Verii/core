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

const { last } = require('lodash/fp');
const { HEX_FORMAT } = require('@verii/test-regexes');
const { publicKeyMatcher } = require('./matchers');

const generateOrganizationKeyMatcher = ({
  kid,
  purpose,
  purposes,
  custodied = false,
  type = 'JsonWebKey2020',
  withKidFragment = false,
  withPrivateKey = false,
}) => {
  const baseMatcher = {
    algorithm: 'SECP256K1',
    purposes: purposes ?? [purpose],
    custodied,
  };

  if (withKidFragment) {
    baseMatcher.kidFragment = kid;
    baseMatcher.didDocumentKey = {
      id: kid,
      type: expect.stringMatching(
        /^(JsonWebKey2020|Ed25519VerificationKey2018|EcdsaSecp256k1VerificationKey2019|SECP256K1)$/
      ),
      controller: expect.any(String),
      ...(type === 'JsonWebKey2020'
        ? {
            publicKeyJwk: publicKeyMatcher,
          }
        : {
            publicKeyMultibase: expect.stringMatching(HEX_FORMAT),
          }),
    };
  } else {
    baseMatcher.id = kidMatcher(kid);
  }

  if (withPrivateKey) {
    baseMatcher.encoding = 'hex';
    baseMatcher.key = expect.stringMatching(HEX_FORMAT);
  }
  return baseMatcher;
};

const kidMatcher = (kid) => {
  if (kid instanceof RegExp) {
    return expect.stringMatching(kid);
  }

  return `#${last(kid.split('#'))}`;
};

module.exports = { generateOrganizationKeyMatcher };
