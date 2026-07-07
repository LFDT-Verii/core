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

const { describe, it } = require('node:test');
const crypto = require('node:crypto');
const { expect } = require('expect');
const {
  buildCredentialIssuedEvent,
  buildCredentialRejectedEvent,
  buildNotificationConfig,
  buildPresentationReceivedEvent,
  buildWebhookSignatureHeaders,
  matchesNotificationEventType,
  shouldEmitNotificationEvent,
} = require('../../src/entities/notifications');

describe('notification domain', () => {
  describe('buildNotificationConfig', () => {
    it('should allow notifications to be disabled without webhook config', () => {
      expect(buildNotificationConfig({ enabled: false })).toEqual(
        expect.objectContaining({
          enabled: false,
          queue: expect.objectContaining({
            type: 'mongo',
          }),
          workerMode: 'embedded-child',
          retentionDays: 30,
        }),
      );
    });

    it('should validate enabled webhook config', () => {
      expect(() =>
        buildNotificationConfig({
          enabled: true,
          webhookUrl: 'http://operator.localhost.test/events',
          webhookSecret: 'secret',
        }),
      ).toThrow('Notifications webhook URL must use https');

      expect(
        buildNotificationConfig({
          enabled: true,
          workerMode: 'standalone',
          webhookUrl: 'https://operator.localhost.test/events',
          webhookEventTypes: 'presentation.received,credential.*',
          webhookSecret: 'secret',
        }),
      ).toEqual(
        expect.objectContaining({
          enabled: true,
          workerMode: 'standalone',
          webhook: expect.objectContaining({
            url: 'https://operator.localhost.test/events',
            eventTypes: ['presentation.received', 'credential.*'],
            secret: 'secret',
          }),
        }),
      );
    });

    it('should reject invalid worker modes', () => {
      expect(() =>
        buildNotificationConfig({ workerMode: 'in-process' }),
      ).toThrow('Invalid notifications worker mode: in-process');
    });

    it('should reject invalid queue types', () => {
      expect(() => buildNotificationConfig({ queueType: 'rabbit' })).toThrow(
        'Invalid notifications queue type: rabbit',
      );
    });
  });

  describe('event type matching', () => {
    it('should match all events, exact event types, and wildcard suffixes', () => {
      expect(matchesNotificationEventType('credential.issued', '*')).toEqual(
        true,
      );
      expect(
        matchesNotificationEventType('credential.issued', 'credential.issued'),
      ).toEqual(true);
      expect(
        matchesNotificationEventType('credential.issued', 'credential.*'),
      ).toEqual(true);
      expect(
        matchesNotificationEventType('presentation.received', 'credential.*'),
      ).toEqual(false);
    });

    it('should require enabled notifications and a configured event type', () => {
      expect(
        shouldEmitNotificationEvent('credential.issued', {
          enabled: false,
          webhook: { eventTypes: ['credential.*'] },
        }),
      ).toEqual(false);
      expect(
        shouldEmitNotificationEvent('credential.issued', {
          enabled: true,
          webhook: { eventTypes: ['credential.*'] },
        }),
      ).toEqual(true);
    });
  });

  describe('event builders', () => {
    it('should build a presentation payload without the full presentation', () => {
      const event = buildPresentationReceivedEvent({
        tenant: { _id: 'tenant-id', did: 'did:web:issuer.example' },
        exchange: {
          _id: 'exchange-id',
          serviceId: 'service-id',
          depotId: 'depot-id',
        },
        presentation: {
          _id: 'presentation-id',
          format: 'JWT_VP',
          presentation: 'full-vp-jwt',
          createdAt: new Date('2026-06-25T10:15:30.000Z'),
        },
        id: 'evt_test',
      });

      expect(event).toEqual({
        id: 'evt_test',
        type: 'presentation.received',
        version: 1,
        occurredAt: '2026-06-25T10:15:30.000Z',
        tenantId: 'tenant-id',
        tenantDid: 'did:web:issuer.example',
        serviceId: 'service-id',
        depotId: 'depot-id',
        exchangeId: 'exchange-id',
        resource: {
          type: 'presentation',
          id: 'presentation-id',
        },
        data: {
          format: 'JWT_VP',
          verificationStatus: 'received',
        },
        links: {
          presentation:
            '/operator/presentations/get?tenantId=tenant-id&presentationId=presentation-id',
        },
      });
      expect(JSON.stringify(event)).not.toContain('full-vp-jwt');
    });

    it('should build credential payloads without raw credential content', () => {
      const issuedEvent = buildCredentialIssuedEvent({
        tenant: { _id: 'tenant-id', did: 'did:web:issuer.example' },
        exchange: {
          _id: 'exchange-id',
          serviceId: 'service-id',
          depotId: 'depot-id',
        },
        credential: {
          _id: 'credential-id',
          did: 'did:velocity:credential',
          credentialReference: 'employee-123-degree',
          digestSRI: 'sha384-digest',
          acceptedAt: new Date('2026-06-25T10:15:30.000Z'),
          jwtVc: 'full-vc-jwt',
          content: {
            type: ['VerifiableCredential', 'EducationDegree'],
            credentialSubject: { email: 'sensitive@example.test' },
          },
        },
        id: 'evt_issued',
      });
      const rejectedEvent = buildCredentialRejectedEvent({
        tenant: { _id: 'tenant-id', did: 'did:web:issuer.example' },
        exchange: {
          _id: 'exchange-id',
          serviceId: 'service-id',
          depotId: 'depot-id',
        },
        credential: {
          _id: 'credential-id',
          rejectedAt: new Date('2026-06-25T10:16:30.000Z'),
          rejectedReason: ' Credential source data did not pass verification ',
          content: {
            type: ['VerifiableCredential', 'EducationDegree'],
            credentialSubject: { email: 'sensitive@example.test' },
          },
        },
        id: 'evt_rejected',
      });

      expect(issuedEvent.data).toEqual({
        credentialDid: 'did:velocity:credential',
        credentialReference: 'employee-123-degree',
        credentialTypes: ['EducationDegree'],
        digestSRI: 'sha384-digest',
      });
      expect(rejectedEvent.data).toEqual({
        credentialTypes: ['EducationDegree'],
        rejectionReason: 'Credential source data did not pass verification',
        rejectedAt: '2026-06-25T10:16:30.000Z',
      });
      expect(JSON.stringify([issuedEvent, rejectedEvent])).not.toContain(
        'sensitive@example.test',
      );
      expect(JSON.stringify([issuedEvent, rejectedEvent])).not.toContain(
        'full-vc-jwt',
      );
    });

    it('should omit blank credential rejection reasons', () => {
      const rejectedEvent = buildCredentialRejectedEvent({
        tenant: { _id: 'tenant-id', did: 'did:web:issuer.example' },
        exchange: {
          _id: 'exchange-id',
          serviceId: 'service-id',
          depotId: 'depot-id',
        },
        credential: {
          _id: 'credential-id',
          rejectedAt: new Date('2026-06-25T10:16:30.000Z'),
          rejectedReason: '   ',
          content: {
            type: ['VerifiableCredential', 'EducationDegree'],
          },
        },
        id: 'evt_rejected',
      });

      expect(rejectedEvent.data).toEqual({
        credentialTypes: ['EducationDegree'],
        rejectedAt: '2026-06-25T10:16:30.000Z',
      });
    });
  });

  it('should build deterministic webhook signature headers', () => {
    const rawBody = '{"id":"evt_test"}';
    const timestamp = 1792913730;
    const expectedSignature = crypto
      .createHmac('sha256', 'secret')
      .update(`${timestamp}.${rawBody}`)
      .digest('hex');

    expect(
      buildWebhookSignatureHeaders({
        event: {
          id: 'evt_test',
          type: 'credential.issued',
          occurredAt: '2026-06-25T10:15:30.000Z',
        },
        rawBody,
        secret: 'secret',
        timestamp,
      }),
    ).toEqual({
      'Content-Type': 'application/json',
      'Verii-Event-Id': 'evt_test',
      'Verii-Event-Type': 'credential.issued',
      'Verii-Event-Time': '2026-06-25T10:15:30.000Z',
      'Verii-Signature': `t=${timestamp},v1=${expectedSignature}`,
    });
  });
});
