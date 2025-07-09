/* import { CredentialManifestDescriptorMocks } from "path-to-your-mocks"; */
import VCLCredentialManifestDescriptorByDeepLink from '../../src/api/entities/VCLCredentialManifestDescriptorByDeepLink';
import { VCLIssuingType } from '../../src';
import { CredentialManifestDescriptorMocks } from '../infrastructure/resources/valid/CredentialManifestDescriptorMocks';
import VCLPushDelegate from '../../src/api/entities/VCLPushDelegate';
import { DidJwkMocks } from '../infrastructure/resources/valid/DidJwkMocks';
import { DeepLinkMocks } from '../infrastructure/resources/valid/DeepLinkMocks';

describe('VCLCredentialManifestDescriptorByDeepLink Tests', () => {
    let subject: VCLCredentialManifestDescriptorByDeepLink;

    beforeEach(() => {
        // Setup code before each test
    });

    test('testCredentialManifestDescriptorFullValidByDeepLinkSuccess', () => {
        subject = new VCLCredentialManifestDescriptorByDeepLink(
            CredentialManifestDescriptorMocks.DeepLink,
            VCLIssuingType.Career,
            new VCLPushDelegate('some_url', 'some_token'),
            DidJwkMocks.DidJwk
        );

        expect(subject.endpoint).toEqual(
            `${decodeURIComponent(
                CredentialManifestDescriptorMocks.DeepLinkRequestUri
            )}&push_delegate.push_url=some_url&push_delegate.push_token=some_token`
        );
        expect.stringMatching(
            encodeURI(CredentialManifestDescriptorMocks.DeepLinkRequestUri)
        );
        expect(subject.did).toEqual(
            CredentialManifestDescriptorMocks.IssuerDid
        );
        expect(subject.issuingType).toEqual(VCLIssuingType.Career);
        expect(subject.pushDelegate?.pushUrl).toEqual('some_url');
        expect(subject.pushDelegate?.pushToken).toEqual('some_token');
    });

    test('testCredentialManifestDescriptorFullValidByDeepLinkWithIdSuccess', () => {
        subject = new VCLCredentialManifestDescriptorByDeepLink(
            DeepLinkMocks.CredentialManifestDeepLinkMainNetWithId,
            VCLIssuingType.Career,
            new VCLPushDelegate('some_url', 'some_token'),
            DidJwkMocks.DidJwk
        );

        expect(decodeURIComponent(subject.endpoint!)!).toEqual(
            `${DeepLinkMocks.CredentialManifestRequestDecodedUriWithIdStr}&push_delegate.push_url=some_url&push_delegate.push_token=some_token`
        );
        expect(subject.did).toEqual(DeepLinkMocks.IssuerDid);
        expect(subject.pushDelegate?.pushUrl).toEqual('some_url');
        expect(subject.pushDelegate?.pushToken).toEqual('some_token');
    });
});
