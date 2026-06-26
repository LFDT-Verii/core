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

const { nanoid } = require('nanoid');
const { NotificationEventTypes } = require('./event-types');

const NOTIFICATION_PAYLOAD_VERSION = 1;
const VERIFIABLE_CREDENTIAL_TYPE = 'VerifiableCredential';

const buildPresentationReceivedEvent = ({
  tenant,
  exchange,
  presentation,
  id = newNotificationEventId(),
  occurredAt = presentation.createdAt ?? new Date(),
}) => {
  const tenantId = stringifyId(tenant._id);
  const presentationId = stringifyId(presentation._id);

  return buildBaseEvent({
    id,
    type: NotificationEventTypes.DEPOT_PRESENTATION_RECEIVED,
    occurredAt,
    tenant,
    exchange,
    resource: {
      type: 'presentation',
      id: presentationId,
    },
    data: {
      format: presentation.format,
      verificationStatus: 'received',
    },
    links: {
      presentation: `/operator/presentations/get?tenantId=${encodeURIComponent(
        tenantId,
      )}&presentationId=${encodeURIComponent(presentationId)}`,
    },
  });
};

const buildCredentialIssuedEvent = ({
  tenant,
  exchange,
  credential,
  id = newNotificationEventId(),
  occurredAt = credential.acceptedAt ?? new Date(),
}) => {
  const tenantId = stringifyId(tenant._id);
  const credentialId = stringifyId(credential._id);

  return buildBaseEvent({
    id,
    type: NotificationEventTypes.DEPOT_CREDENTIAL_ISSUED,
    occurredAt,
    tenant,
    exchange,
    resource: {
      type: 'credential',
      id: credentialId,
    },
    data: compactObject({
      credentialDid: credential.did,
      credentialReference: credential.credentialReference,
      credentialTypes: getCredentialTypes(credential),
      digestSRI: credential.digestSRI,
    }),
    links: {
      credential: `/operator/credentials/get?tenantId=${encodeURIComponent(
        tenantId,
      )}&credentialId=${encodeURIComponent(credentialId)}`,
    },
  });
};

const buildCredentialRejectedEvent = ({
  tenant,
  exchange,
  credential,
  id = newNotificationEventId(),
  occurredAt = credential.rejectedAt ?? new Date(),
}) => {
  const tenantId = stringifyId(tenant._id);
  const credentialId = stringifyId(credential._id);

  return buildBaseEvent({
    id,
    type: NotificationEventTypes.DEPOT_CREDENTIAL_REJECTED,
    occurredAt,
    tenant,
    exchange,
    resource: {
      type: 'credential',
      id: credentialId,
    },
    data: compactObject({
      credentialReference: credential.credentialReference,
      credentialTypes: getCredentialTypes(credential),
      rejectionReason: sanitizeRejectionReason(credential.rejectedReason),
      rejectedAt: toIsoString(credential.rejectedAt),
    }),
    links: {
      credential: `/operator/credentials/get?tenantId=${encodeURIComponent(
        tenantId,
      )}&credentialId=${encodeURIComponent(credentialId)}`,
    },
  });
};

const buildBaseEvent = ({
  id,
  type,
  occurredAt,
  tenant,
  exchange,
  resource,
  data,
  links,
}) => ({
  id,
  type,
  version: NOTIFICATION_PAYLOAD_VERSION,
  occurredAt: toIsoString(occurredAt),
  tenantId: stringifyId(tenant._id),
  tenantDid: tenant.did,
  serviceId: stringifyId(exchange.serviceId),
  depotId: stringifyId(exchange.depotId),
  exchangeId: stringifyId(exchange._id),
  resource,
  data,
  links,
});

const newNotificationEventId = () => `evt_${nanoid()}`;

const getCredentialTypes = (credential) => {
  const contentTypes = Array.isArray(credential.content?.type)
    ? credential.content.type
    : [credential.content?.type];
  const typeMetadataType = credential.typeMetadata?.credentialType;
  const types = [...contentTypes, typeMetadataType].filter(
    (type) => type && type !== VERIFIABLE_CREDENTIAL_TYPE,
  );

  return [...new Set(types)];
};

const sanitizeRejectionReason = (rejectedReason) => {
  if (typeof rejectedReason !== 'string') {
    return undefined;
  }

  const trimmedReason = rejectedReason.trim();
  if (!trimmedReason) {
    return undefined;
  }

  return trimmedReason.slice(0, 500);
};

const compactObject = (obj) =>
  Object.fromEntries(Object.entries(obj).filter(([, value]) => value != null));

const stringifyId = (value) => {
  if (value == null) {
    return undefined;
  }

  return value.toString();
};

const toIsoString = (value) => {
  if (value == null) {
    return undefined;
  }

  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return undefined;
  }

  return date.toISOString();
};

module.exports = {
  buildCredentialIssuedEvent,
  buildCredentialRejectedEvent,
  buildPresentationReceivedEvent,
  newNotificationEventId,
};
