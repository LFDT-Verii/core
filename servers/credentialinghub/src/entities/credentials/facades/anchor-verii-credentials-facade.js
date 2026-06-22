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
const { anchorVeriiCredentials } = require('@verii/verii-issuing');
const newError = require('http-errors');
const { buildVeriiIssuer } = require('./build-verii-issuer');

const anchorVeriiCredentialsFacade = (credentialMetadatas, context) => {
  const issuer = buildVeriiIssuer(context.tenant);
  // eslint-disable-next-line better-mutation/no-mutation
  context.caoDid = context.tenant.caoDid;
  return anchorVeriiCredentials(credentialMetadatas, issuer, context).catch(
    (e) => {
      context.log.error({
        err: e,
        fn: 'anchorVeriiCredentials',
        args: { credentialMetadatas },
      });

      switch (e.errorCode) {
        case 'career_issuing_not_permitted':
        case 'identity_issuing_not_permitted':
        case 'contact_issuing_not_permitted':
          throw newError(502, e);
        default:
          throw e;
      }
    },
  );
};

module.exports = { anchorVeriiCredentialsFacade };
