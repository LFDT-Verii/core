import { describe, test } from 'node:test';
import { expect } from 'expect';
import VCLCredentialManifestDescriptorRefresh from '../../src/api/entities/VCLCredentialManifestDescriptorRefresh';
import VCLService from '../../src/api/entities/VCLService';
import { CredentialManifestDescriptorMocks } from '../infrastructure/resources/valid/CredentialManifestDescriptorMocks';
import { DidJwkMocks } from '../infrastructure/resources/valid/DidJwkMocks';

describe('VCLCredentialManifestDescriptorRefresh Tests', () => {
    let subject: VCLCredentialManifestDescriptorRefresh;

    test('testCredentialManifestDescriptorWith2CredentialIdsSuccess', () => {
        const service = new VCLService(
            JSON.parse(CredentialManifestDescriptorMocks.IssuingServiceJsonStr)
        );
        subject = new VCLCredentialManifestDescriptorRefresh(
            service,
            [
                CredentialManifestDescriptorMocks.CredentialId1,
                CredentialManifestDescriptorMocks.CredentialId2,
            ],
            DidJwkMocks.DidJwk,
            '123'
        );

        const credentialTypesQuery = `${
            VCLCredentialManifestDescriptorRefresh.KeyRefresh
        }=true&${
            VCLCredentialManifestDescriptorRefresh.KeyCredentialId
        }=${encodeURIComponent(
            CredentialManifestDescriptorMocks.CredentialId1
        )}&${
            VCLCredentialManifestDescriptorRefresh.KeyCredentialId
        }=${encodeURIComponent(
            CredentialManifestDescriptorMocks.CredentialId2
        )}`;
        const mockEndpoint = `${CredentialManifestDescriptorMocks.IssuingServiceEndPoint}?${credentialTypesQuery}`;

        expect(subject.endpoint).toEqual(mockEndpoint);
        expect(subject.did).toEqual('123');
    });

    test('testCredentialManifestDescriptorWith1CredentialIdsSuccess', () => {
        const service = new VCLService(
            JSON.parse(CredentialManifestDescriptorMocks.IssuingServiceJsonStr)
        );
        subject = new VCLCredentialManifestDescriptorRefresh(
            service,
            [CredentialManifestDescriptorMocks.CredentialId1],
            DidJwkMocks.DidJwk,
            '123'
        );

        const credentialTypesQuery = `${
            VCLCredentialManifestDescriptorRefresh.KeyRefresh
        }=true&${
            VCLCredentialManifestDescriptorRefresh.KeyCredentialId
        }=${encodeURIComponent(
            CredentialManifestDescriptorMocks.CredentialId1
        )}`;
        const mockEndpoint = `${CredentialManifestDescriptorMocks.IssuingServiceEndPoint}?${credentialTypesQuery}`;

        expect(subject.endpoint).toEqual(mockEndpoint);
        expect(subject.did).toEqual('123');
    });

    test('testCredentialManifestDescriptorWith0CredentialIdsSuccess', () => {
        const service = new VCLService(
            JSON.parse(CredentialManifestDescriptorMocks.IssuingServiceJsonStr)
        );
        subject = new VCLCredentialManifestDescriptorRefresh(
            service,
            [],
            DidJwkMocks.DidJwk,
            '123'
        );

        const credentialTypesQuery = `${VCLCredentialManifestDescriptorRefresh.KeyRefresh}=true`;
        const mockEndpoint = `${CredentialManifestDescriptorMocks.IssuingServiceEndPoint}?${credentialTypesQuery}`;

        expect(subject.endpoint).toEqual(mockEndpoint);
        expect(subject.did).toEqual('123');
    });
});
