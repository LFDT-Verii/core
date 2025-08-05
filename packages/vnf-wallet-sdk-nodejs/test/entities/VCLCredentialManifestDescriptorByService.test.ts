/* eslint-disable max-len */

import { describe, test } from 'node:test';
import { expect } from 'expect';
import VCLCredentialManifestDescriptorByService from '../../src/api/entities/VCLCredentialManifestDescriptorByService';
import { VCLIssuingType } from '../../src';
import VCLService from '../../src/api/entities/VCLService';
import { CredentialManifestDescriptorMocks } from '../infrastructure/resources/valid/CredentialManifestDescriptorMocks';
import { DidJwkMocks } from '../infrastructure/resources/valid/DidJwkMocks';

describe('VCLCredentialManifestDescriptorByService Tests', () => {
    let subject: VCLCredentialManifestDescriptorByService;

    test('testCredentialManifestDescriptorByServiceWithFullInput1Success', () => {
        const service = new VCLService(
            JSON.parse(CredentialManifestDescriptorMocks.IssuingServiceJsonStr)
        );
        subject = new VCLCredentialManifestDescriptorByService(
            service,
            VCLIssuingType.Career,
            CredentialManifestDescriptorMocks.CredentialTypesList,
            CredentialManifestDescriptorMocks.PushDelegate,
            DidJwkMocks.DidJwk,
            '123'
        );

        const credentialTypesQuery = `${
            VCLCredentialManifestDescriptorByService.KeyCredentialTypes
        }=${CredentialManifestDescriptorMocks.CredentialTypesList[0]}&${
            VCLCredentialManifestDescriptorByService.KeyCredentialTypes
        }=${CredentialManifestDescriptorMocks.CredentialTypesList[1]}&${
            VCLCredentialManifestDescriptorByService.KeyPushDelegatePushUrl
        }=${encodeURIComponent(
            CredentialManifestDescriptorMocks.PushDelegate.pushUrl
        )}&${
            VCLCredentialManifestDescriptorByService.KeyPushDelegatePushToken
        }=${encodeURIComponent(
            CredentialManifestDescriptorMocks.PushDelegate.pushToken
        )}`;
        const mockEndpoint = `${CredentialManifestDescriptorMocks.IssuingServiceEndPoint}?${credentialTypesQuery}`;

        expect(subject.endpoint).toEqual(mockEndpoint);
        expect(subject.did).toEqual('123');
    });

    test('testCredentialManifestDescriptorByServiceWithFullInput2Success', () => {
        const service = new VCLService(
            JSON.parse(CredentialManifestDescriptorMocks.IssuingServiceJsonStr)
        );
        subject = new VCLCredentialManifestDescriptorByService(
            service,
            VCLIssuingType.Identity,
            CredentialManifestDescriptorMocks.CredentialTypesList,
            CredentialManifestDescriptorMocks.PushDelegate,
            DidJwkMocks.DidJwk,
            '123'
        );

        const credentialTypesQuery = `${
            VCLCredentialManifestDescriptorByService.KeyCredentialTypes
        }=${CredentialManifestDescriptorMocks.CredentialTypesList[0]}&${
            VCLCredentialManifestDescriptorByService.KeyCredentialTypes
        }=${CredentialManifestDescriptorMocks.CredentialTypesList[1]}&${
            VCLCredentialManifestDescriptorByService.KeyPushDelegatePushUrl
        }=${encodeURIComponent(
            CredentialManifestDescriptorMocks.PushDelegate.pushUrl
        )}&${
            VCLCredentialManifestDescriptorByService.KeyPushDelegatePushToken
        }=${encodeURIComponent(
            CredentialManifestDescriptorMocks.PushDelegate.pushToken
        )}`;
        const mockEndpoint = `${CredentialManifestDescriptorMocks.IssuingServiceEndPoint}?${credentialTypesQuery}`;

        expect(subject.endpoint).toEqual(mockEndpoint);
        expect(subject.did).toEqual('123');
    });

    test('testCredentialManifestDescriptorByServiceWithPartialInput3Success', () => {
        const service = new VCLService(
            JSON.parse(CredentialManifestDescriptorMocks.IssuingServiceJsonStr)
        );
        subject = new VCLCredentialManifestDescriptorByService(
            service,
            VCLIssuingType.Career,
            undefined,
            CredentialManifestDescriptorMocks.PushDelegate,
            DidJwkMocks.DidJwk,
            '123'
        );

        const credentialTypesQuery = `${
            VCLCredentialManifestDescriptorByService.KeyPushDelegatePushUrl
        }=${encodeURIComponent(
            CredentialManifestDescriptorMocks.PushDelegate.pushUrl
        )}&${
            VCLCredentialManifestDescriptorByService.KeyPushDelegatePushToken
        }=${encodeURIComponent(
            CredentialManifestDescriptorMocks.PushDelegate.pushToken
        )}`;
        const mockEndpoint = `${CredentialManifestDescriptorMocks.IssuingServiceEndPoint}?${credentialTypesQuery}`;

        expect(subject.endpoint).toEqual(mockEndpoint);
        expect(subject.did).toEqual('123');
    });

    test('testCredentialManifestDescriptorByServiceWithPartialInput4Success', () => {
        const service = new VCLService(
            JSON.parse(
                CredentialManifestDescriptorMocks.IssuingServiceWithParamJsonStr
            )
        );
        subject = new VCLCredentialManifestDescriptorByService(
            service,
            VCLIssuingType.Career,
            CredentialManifestDescriptorMocks.CredentialTypesList,
            null,
            DidJwkMocks.DidJwk,
            '123'
        );

        const credentialTypesQuery = `${VCLCredentialManifestDescriptorByService.KeyCredentialTypes}=${CredentialManifestDescriptorMocks.CredentialTypesList[0]}&${VCLCredentialManifestDescriptorByService.KeyCredentialTypes}=${CredentialManifestDescriptorMocks.CredentialTypesList[1]}`;
        const mockEndpoint = `${CredentialManifestDescriptorMocks.IssuingServiceWithParamEndPoint}&${credentialTypesQuery}`;

        expect(subject.endpoint).toEqual(mockEndpoint);
        expect(subject.did).toEqual('123');
    });

    test('testCredentialManifestDescriptorByServiceWithPartialInput5Success', () => {
        const service = new VCLService(
            JSON.parse(
                CredentialManifestDescriptorMocks.IssuingServiceWithParamJsonStr
            )
        );
        subject = new VCLCredentialManifestDescriptorByService(
            service,
            VCLIssuingType.Career,
            null,
            null,
            DidJwkMocks.DidJwk,
            '123'
        );

        const mockEndpoint =
            CredentialManifestDescriptorMocks.IssuingServiceWithParamEndPoint;

        expect(subject.endpoint).toEqual(mockEndpoint);
        expect(subject.did).toEqual('123');
    });

    test('testCredentialManifestDescriptorByServiceWithPartialInput6Success', () => {
        const service = new VCLService(
            JSON.parse(CredentialManifestDescriptorMocks.IssuingServiceJsonStr)
        );
        subject = new VCLCredentialManifestDescriptorByService(
            service,
            VCLIssuingType.Career,
            null,
            null,
            DidJwkMocks.DidJwk,
            '123'
        );

        const mockEndpoint =
            CredentialManifestDescriptorMocks.IssuingServiceEndPoint;

        expect(subject.endpoint).toEqual(mockEndpoint);
        expect(subject.did).toEqual('123');
    });
});
