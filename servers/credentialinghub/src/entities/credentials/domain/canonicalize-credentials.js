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
const { ObjectId } = require('mongodb');
const { hashOffer } = require('@verii/verii-issuing');
const { isEmpty, map, keyBy } = require('lodash/fp');

const initCanonicalizeCredentials = (
  relatedCredentials,
  credentialTypeMetadatas,
) => {
  const defaultCredentialContent =
    initDefaultCredentialContent(relatedCredentials);
  return ({ credential, depotId, metadataIdx }) => ({
    ...credential,
    depotId: new ObjectId(depotId),
    content: defaultCredentialContent(credential.content),
    contentHash: hashOffer(credential.content),
    typeMetadata: credentialTypeMetadatas[metadataIdx],
  });
};

const initDefaultCredentialContent = (relatedCredentials) => {
  const defaultRelatedResource = initDefaultRelatedResource(relatedCredentials);
  return (content) => {
    if (!isEmpty(content.relatedResource)) {
      // eslint-disable-next-line better-mutation/no-mutation
      content.relatedResource = map(
        defaultRelatedResource,
        content.relatedResource,
      );
    }

    if (!isEmpty(content.replaces)) {
      // eslint-disable-next-line better-mutation/no-mutation
      content.replaces = map(defaultRelatedResource, content.replaces);
    }
    return content;
  };
};

const initDefaultRelatedResource = (relatedCredentials) => {
  const credentialRefsMap = keyBy('did', relatedCredentials);
  return (resource) => {
    const credentialRef = credentialRefsMap[resource.id];
    if (!isEmpty(credentialRef)) {
      // eslint-disable-next-line better-mutation/no-mutation
      resource.digestSRI = resource.digestSRI ?? credentialRef.digestSRI;
      // eslint-disable-next-line better-mutation/no-mutation
      resource.hint = resource.hint ?? credentialRef.content.type;
    }

    return resource;
  };
};

module.exports = { initCanonicalizeCredentials };
