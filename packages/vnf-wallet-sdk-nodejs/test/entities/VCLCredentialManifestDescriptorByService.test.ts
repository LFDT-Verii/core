import { describe, test } from 'node:test';
import { expect } from 'expect';
import VCLCredentialManifestDescriptorByService from '../../src/api/entities/VCLCredentialManifestDescriptorByService';
import { VCLIssuingType } from '../../src';
import VCLService from '../../src/api/entities/VCLService';
import { CredentialManifestDescriptorMocks } from '../infrastructure/resources/valid/CredentialManifestDescriptorMocks';
import { DidJwkMocks } from '../infrastructure/resources/valid/DidJwkMocks';

describe('VCLCredentialManifestDescriptorByService', () => {
    let subject: VCLCredentialManifestDescriptorByService;

    test('builds an endpoint with credential types and a push delegate for career issuance', () => {
        const service = new VCLService(
            JSON.parse(CredentialManifestDescriptorMocks.IssuingServiceJsonStr),
        );
        subject = new VCLCredentialManifestDescriptorByService(
            service,
            VCLIssuingType.Career,
            CredentialManifestDescriptorMocks.CredentialTypesList,
            CredentialManifestDescriptorMocks.PushDelegate,
            DidJwkMocks.DidJwk,
            '123',
        );

        const credentialTypesQuery = `${
            VCLCredentialManifestDescriptorByService.KeyCredentialTypes
        }=${CredentialManifestDescriptorMocks.CredentialTypesList[0]}&${
            VCLCredentialManifestDescriptorByService.KeyCredentialTypes
        }=${CredentialManifestDescriptorMocks.CredentialTypesList[1]}&${
            VCLCredentialManifestDescriptorByService.KeyPushDelegatePushUrl
        }=${encodeURIComponent(
            CredentialManifestDescriptorMocks.PushDelegate.pushUrl,
        )}&${
            VCLCredentialManifestDescriptorByService.KeyPushDelegatePushToken
        }=${encodeURIComponent(
            CredentialManifestDescriptorMocks.PushDelegate.pushToken,
        )}`;
        const mockEndpoint = `${CredentialManifestDescriptorMocks.IssuingServiceEndPoint}?${credentialTypesQuery}`;

        expect(subject.endpoint).toEqual(mockEndpoint);
        expect(subject.did).toEqual('123');
    });

    test('builds an endpoint with credential types and a push delegate for identity issuance', () => {
        const service = new VCLService(
            JSON.parse(CredentialManifestDescriptorMocks.IssuingServiceJsonStr),
        );
        subject = new VCLCredentialManifestDescriptorByService(
            service,
            VCLIssuingType.Identity,
            CredentialManifestDescriptorMocks.CredentialTypesList,
            CredentialManifestDescriptorMocks.PushDelegate,
            DidJwkMocks.DidJwk,
            '123',
        );

        const credentialTypesQuery = `${
            VCLCredentialManifestDescriptorByService.KeyCredentialTypes
        }=${CredentialManifestDescriptorMocks.CredentialTypesList[0]}&${
            VCLCredentialManifestDescriptorByService.KeyCredentialTypes
        }=${CredentialManifestDescriptorMocks.CredentialTypesList[1]}&${
            VCLCredentialManifestDescriptorByService.KeyPushDelegatePushUrl
        }=${encodeURIComponent(
            CredentialManifestDescriptorMocks.PushDelegate.pushUrl,
        )}&${
            VCLCredentialManifestDescriptorByService.KeyPushDelegatePushToken
        }=${encodeURIComponent(
            CredentialManifestDescriptorMocks.PushDelegate.pushToken,
        )}`;
        const mockEndpoint = `${CredentialManifestDescriptorMocks.IssuingServiceEndPoint}?${credentialTypesQuery}`;

        expect(subject.endpoint).toEqual(mockEndpoint);
        expect(subject.did).toEqual('123');
    });

    test('builds an endpoint with only a push delegate', () => {
        const service = new VCLService(
            JSON.parse(CredentialManifestDescriptorMocks.IssuingServiceJsonStr),
        );
        subject = new VCLCredentialManifestDescriptorByService(
            service,
            VCLIssuingType.Career,
            undefined,
            CredentialManifestDescriptorMocks.PushDelegate,
            DidJwkMocks.DidJwk,
            '123',
        );

        const credentialTypesQuery = `${
            VCLCredentialManifestDescriptorByService.KeyPushDelegatePushUrl
        }=${encodeURIComponent(
            CredentialManifestDescriptorMocks.PushDelegate.pushUrl,
        )}&${
            VCLCredentialManifestDescriptorByService.KeyPushDelegatePushToken
        }=${encodeURIComponent(
            CredentialManifestDescriptorMocks.PushDelegate.pushToken,
        )}`;
        const mockEndpoint = `${CredentialManifestDescriptorMocks.IssuingServiceEndPoint}?${credentialTypesQuery}`;

        expect(subject.endpoint).toEqual(mockEndpoint);
        expect(subject.did).toEqual('123');
    });

    test('appends credential types to an endpoint with existing query params', () => {
        const service = new VCLService(
            JSON.parse(
                CredentialManifestDescriptorMocks.IssuingServiceWithParamJsonStr,
            ),
        );
        subject = new VCLCredentialManifestDescriptorByService(
            service,
            VCLIssuingType.Career,
            CredentialManifestDescriptorMocks.CredentialTypesList,
            null,
            DidJwkMocks.DidJwk,
            '123',
        );

        const credentialTypesQuery = [
            `${VCLCredentialManifestDescriptorByService.KeyCredentialTypes}=${CredentialManifestDescriptorMocks.CredentialTypesList[0]}`,
            `${VCLCredentialManifestDescriptorByService.KeyCredentialTypes}=${CredentialManifestDescriptorMocks.CredentialTypesList[1]}`,
        ].join('&');
        const mockEndpoint = `${CredentialManifestDescriptorMocks.IssuingServiceWithParamEndPoint}&${credentialTypesQuery}`;

        expect(subject.endpoint).toEqual(mockEndpoint);
        expect(subject.did).toEqual('123');
    });

    test('preserves an endpoint with existing query params when optional params are absent', () => {
        const service = new VCLService(
            JSON.parse(
                CredentialManifestDescriptorMocks.IssuingServiceWithParamJsonStr,
            ),
        );
        subject = new VCLCredentialManifestDescriptorByService(
            service,
            VCLIssuingType.Career,
            null,
            null,
            DidJwkMocks.DidJwk,
            '123',
        );

        const mockEndpoint =
            CredentialManifestDescriptorMocks.IssuingServiceWithParamEndPoint;

        expect(subject.endpoint).toEqual(mockEndpoint);
        expect(subject.did).toEqual('123');
    });

    test('preserves an endpoint when optional params are absent', () => {
        const service = new VCLService(
            JSON.parse(CredentialManifestDescriptorMocks.IssuingServiceJsonStr),
        );
        subject = new VCLCredentialManifestDescriptorByService(
            service,
            VCLIssuingType.Career,
            null,
            null,
            DidJwkMocks.DidJwk,
            '123',
        );

        const mockEndpoint =
            CredentialManifestDescriptorMocks.IssuingServiceEndPoint;

        expect(subject.endpoint).toEqual(mockEndpoint);
        expect(subject.did).toEqual('123');
    });
});
