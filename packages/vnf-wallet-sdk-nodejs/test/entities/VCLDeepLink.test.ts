import { describe, test } from 'node:test';
import { expect } from 'expect';
import VCLDeepLink from '../../src/api/entities/VCLDeepLink';
import { DeepLinkMocks } from '../infrastructure/resources/valid/DeepLinkMocks';

describe('VCLDeepLink Tests', () => {
    test('testOpenidInitiateIssuance', () => {
        const subject = new VCLDeepLink(
            DeepLinkMocks.OpenidInitiateIssuanceStrDev
        );

        expect(subject.value).toEqual(
            DeepLinkMocks.OpenidInitiateIssuanceStrDev
        );
        expect(decodeURIComponent(subject.value)).toEqual(
            decodeURIComponent(DeepLinkMocks.OpenidInitiateIssuanceStrDev)
        );
        expect(subject.requestUri).toBeFalsy();
        expect(subject.did).toEqual(DeepLinkMocks.OIDIssuerDid);
    });

    test('testPresentationRequestDeepLinkDevNetValidAggregation', () => {
        const subject = new VCLDeepLink(
            DeepLinkMocks.PresentationRequestDeepLinkDevNetStr
        );

        expect(subject.value).toEqual(
            DeepLinkMocks.PresentationRequestDeepLinkDevNetStr
        );
        expect(decodeURIComponent(subject.value)).toEqual(
            decodeURIComponent(
                DeepLinkMocks.PresentationRequestDeepLinkDevNetStr
            )
        );
        expect(subject.requestUri!).toEqual(
            DeepLinkMocks.PresentationRequestRequestDecodedUriStr
        );
        expect(subject.vendorOriginContext).toEqual(
            DeepLinkMocks.PresentationRequestVendorOriginContext
        );
        expect(subject.did).toEqual(DeepLinkMocks.InspectorDid);
    });

    test('testPresentationRequestDeepLinkTestNetValidAggregation', () => {
        const subject = new VCLDeepLink(
            DeepLinkMocks.PresentationRequestDeepLinkTestNetStr
        );

        expect(subject.value).toEqual(
            DeepLinkMocks.PresentationRequestDeepLinkTestNetStr
        );

        expect(decodeURIComponent(subject.value)).toEqual(
            decodeURIComponent(
                DeepLinkMocks.PresentationRequestDeepLinkTestNetStr
            )
        );
        expect(subject.requestUri!).toEqual(
            DeepLinkMocks.PresentationRequestRequestDecodedUriStr
        );
        expect(subject.vendorOriginContext).toEqual(
            DeepLinkMocks.PresentationRequestVendorOriginContext
        );
        expect(subject.did).toEqual(DeepLinkMocks.InspectorDid);
    });

    test('testPresentationRequestDeepLinkMainNetValidAggregation', () => {
        const subject = new VCLDeepLink(
            DeepLinkMocks.PresentationRequestDeepLinkMainNetStr
        );

        expect(subject.value).toEqual(
            DeepLinkMocks.PresentationRequestDeepLinkMainNetStr
        );
        expect(decodeURIComponent(subject.value)).toEqual(
            decodeURIComponent(
                DeepLinkMocks.PresentationRequestDeepLinkMainNetStr
            )
        );
        expect(subject.requestUri!).toEqual(
            DeepLinkMocks.PresentationRequestRequestDecodedUriStr
        );
        expect(subject.vendorOriginContext).toEqual(
            DeepLinkMocks.PresentationRequestVendorOriginContext
        );
        expect(subject.did).toEqual(DeepLinkMocks.InspectorDid);
    });

    test('testCredentialManifestDeepLinkDevNetValidAggregation', () => {
        const subject = new VCLDeepLink(
            DeepLinkMocks.CredentialManifestDeepLinkDevNetStr
        );

        expect(subject.value).toEqual(
            DeepLinkMocks.CredentialManifestDeepLinkDevNetStr
        );
        expect(decodeURIComponent(subject.value)).toEqual(
            decodeURIComponent(
                DeepLinkMocks.CredentialManifestDeepLinkDevNetStr
            )
        );
        expect(decodeURIComponent(subject.requestUri!)).toEqual(
            DeepLinkMocks.CredentialManifestRequestDecodedUriStr
        );
        expect(subject.vendorOriginContext).toBeFalsy();
        expect(subject.did).toEqual(DeepLinkMocks.IssuerDid);
    });

    test('testCredentialManifestDeepLinkTestNetValidAggregation', () => {
        const subject = new VCLDeepLink(
            DeepLinkMocks.CredentialManifestDeepLinkTestNetStr
        );

        expect(subject.value).toEqual(
            DeepLinkMocks.CredentialManifestDeepLinkTestNetStr
        );
        expect(decodeURIComponent(subject.value)).toEqual(
            decodeURIComponent(
                DeepLinkMocks.CredentialManifestDeepLinkTestNetStr
            )
        );
        expect(decodeURIComponent(subject.requestUri!)).toEqual(
            DeepLinkMocks.CredentialManifestRequestDecodedUriStr
        );
        expect(subject.vendorOriginContext).toBeFalsy();
        expect(subject.did).toEqual(DeepLinkMocks.IssuerDid);
    });

    test('testCredentialManifestDeepLinkMainNetValidAggregation', () => {
        const subject = new VCLDeepLink(
            DeepLinkMocks.CredentialManifestDeepLinkMainNetStr
        );

        expect(subject.value).toEqual(
            DeepLinkMocks.CredentialManifestDeepLinkMainNetStr
        );
        expect(decodeURIComponent(subject.value)).toEqual(
            decodeURIComponent(
                DeepLinkMocks.CredentialManifestDeepLinkMainNetStr
            )
        );
        expect(decodeURIComponent(subject.requestUri!)).toEqual(
            DeepLinkMocks.CredentialManifestRequestDecodedUriStr
        );
        expect(subject.vendorOriginContext).toBeFalsy();
        expect(subject.did).toEqual(DeepLinkMocks.IssuerDid);
    });
});
