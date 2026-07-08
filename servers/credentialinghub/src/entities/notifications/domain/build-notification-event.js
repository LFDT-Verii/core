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
const { castArray, compact, isNil, omitBy, uniq } = require('lodash/fp');
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
  const tenantId = tenant._id.toString();
  const presentationId = presentation._id.toString();

  return buildBaseEvent({
    id,
    type: NotificationEventTypes.PRESENTATION_RECEIVED,
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
  const tenantId = tenant._id.toString();
  const credentialId = credential._id.toString();

  return buildBaseEvent({
    id,
    type: NotificationEventTypes.CREDENTIAL_ISSUED,
    occurredAt,
    tenant,
    exchange,
    resource: {
      type: 'credential',
      id: credentialId,
    },
    data: omitBy(isNil, {
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
  const tenantId = tenant._id.toString();
  const credentialId = credential._id.toString();

  return buildBaseEvent({
    id,
    type: NotificationEventTypes.CREDENTIAL_REJECTED,
    occurredAt,
    tenant,
    exchange,
    resource: {
      type: 'credential',
      id: credentialId,
    },
    data: omitBy(isNil, {
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
  tenantId: tenant._id.toString(),
  tenantDid: tenant.did,
  serviceId: exchange.serviceId.toString(),
  depotId: exchange.depotId.toString(),
  exchangeId: exchange._id.toString(),
  resource,
  data,
  links,
});

const newNotificationEventId = () => `evt_${nanoid()}`;

const getCredentialTypes = (credential) =>
  uniq(compact(castArray(credential.content?.type))).filter(
    (type) => type !== VERIFIABLE_CREDENTIAL_TYPE,
  );

const sanitizeRejectionReason = (rejectedReason) => {
  const trimmedReason = rejectedReason?.trim();

  return trimmedReason ? trimmedReason.slice(0, 500) : undefined;
};

const toIsoString = (value) => {
  if (value == null) {
    return undefined;
  }

  const date = value instanceof Date ? value : new Date(value);

  return date.toISOString();
};

module.exports = {
  buildCredentialIssuedEvent,
  buildCredentialRejectedEvent,
  buildPresentationReceivedEvent,
  newNotificationEventId,
};
