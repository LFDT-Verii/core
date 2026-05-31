import { describe, test } from 'node:test';
import { expect } from 'expect';
import { VCLErrorCode } from '../../src';
import VCLPresentationRequestDescriptor from '../../src/api/entities/VCLPresentationRequestDescriptor';
import PublicRequestDescriptorValidator from '../../src/impl/utils/PublicRequestDescriptorValidator';
import { ErrorTaxonomy } from '../../src/impl/utils/ErrorTaxonomy';
import { PresentationRequestDescriptorMocks } from '../infrastructure/resources/valid/PresentationRequestDescriptorMocks';
import { DidJwkMocks } from '../infrastructure/resources/valid/DidJwkMocks';
import { DeepLinkMocks } from '../infrastructure/resources/valid/DeepLinkMocks';

describe('VCLPresentationRequestDescriptor', () => {
    let subject: VCLPresentationRequestDescriptor;

    test('creates a descriptor with a push delegate', () => {
        subject = new VCLPresentationRequestDescriptor(
            PresentationRequestDescriptorMocks.DeepLink,
            PresentationRequestDescriptorMocks.PushDelegate,
            DidJwkMocks.DidJwk,
        );

        const queryParams =
            `${
                VCLPresentationRequestDescriptor.KeyPushDelegatePushUrl
            }=${encodeURIComponent(
                PresentationRequestDescriptorMocks.PushDelegate.pushUrl,
            )}` +
            `&${
                VCLPresentationRequestDescriptor.KeyPushDelegatePushToken
            }=${encodeURIComponent(
                PresentationRequestDescriptorMocks.PushDelegate.pushToken,
            )}`;
        const mockEndpoint = `${decodeURIComponent(
            PresentationRequestDescriptorMocks.RequestUri,
        )}?${queryParams}`;

        expect(subject.endpoint).toEqual(mockEndpoint);
        expect(subject.pushDelegate?.pushUrl).toEqual(
            PresentationRequestDescriptorMocks.PushDelegate.pushUrl,
        );
        expect(subject.pushDelegate?.pushToken).toEqual(
            PresentationRequestDescriptorMocks.PushDelegate.pushToken,
        );
        expect(subject.did).toEqual(
            PresentationRequestDescriptorMocks.InspectorDid,
        );
    });

    test('creates a descriptor without a push delegate', () => {
        subject = new VCLPresentationRequestDescriptor(
            PresentationRequestDescriptorMocks.DeepLink,
            null,
            DidJwkMocks.DidJwk,
        );

        expect(subject.endpoint).toEqual(
            decodeURIComponent(PresentationRequestDescriptorMocks.RequestUri),
        );
        expect(subject.pushDelegate).toBeNull();
        expect(subject.did).toEqual(
            PresentationRequestDescriptorMocks.InspectorDid,
        );
    });

    test('creates a descriptor from query params with a push delegate', () => {
        subject = new VCLPresentationRequestDescriptor(
            PresentationRequestDescriptorMocks.DeepLinkWithQParams,
            PresentationRequestDescriptorMocks.PushDelegate,
            DidJwkMocks.DidJwk,
        );

        const queryParams =
            `${
                VCLPresentationRequestDescriptor.KeyPushDelegatePushUrl
            }=${encodeURIComponent(
                PresentationRequestDescriptorMocks.PushDelegate.pushUrl,
            )}` +
            `&${
                VCLPresentationRequestDescriptor.KeyPushDelegatePushToken
            }=${encodeURIComponent(
                PresentationRequestDescriptorMocks.PushDelegate.pushToken,
            )}`;
        const mockEndpoint = `${decodeURIComponent(
            PresentationRequestDescriptorMocks.RequestUri,
        )}?${PresentationRequestDescriptorMocks.QParms}&${queryParams}`;

        expect(subject.endpoint).toEqual(mockEndpoint);
        expect(subject.pushDelegate?.pushUrl).toEqual(
            PresentationRequestDescriptorMocks.PushDelegate.pushUrl,
        );
        expect(subject.pushDelegate?.pushToken).toEqual(
            PresentationRequestDescriptorMocks.PushDelegate.pushToken,
        );
        expect(subject.did).toEqual(
            PresentationRequestDescriptorMocks.InspectorDid,
        );
    });

    test('creates a descriptor from query params without a push delegate', () => {
        subject = new VCLPresentationRequestDescriptor(
            PresentationRequestDescriptorMocks.DeepLinkWithQParams,
            null,
            DidJwkMocks.DidJwk,
        );

        const mockEndpoint = `${decodeURIComponent(
            PresentationRequestDescriptorMocks.RequestUri,
        )}?${PresentationRequestDescriptorMocks.QParms}`;

        expect(subject.endpoint).toEqual(mockEndpoint);
        expect(subject.pushDelegate).toBeNull();
        expect(subject.did).toEqual(
            PresentationRequestDescriptorMocks.InspectorDid,
        );
    });

    test('creates a descriptor with an inspector id', () => {
        subject = new VCLPresentationRequestDescriptor(
            DeepLinkMocks.PresentationRequestDeepLinkMainNetWithId,
            null,
            DidJwkMocks.DidJwk,
        );

        const mockEndpoint =
            DeepLinkMocks.PresentationRequestRequestDecodedUriWithIdStr;

        expect(decodeURIComponent(subject.endpoint!)).toEqual(mockEndpoint);

        expect(subject.pushDelegate).toEqual(null);
        expect(subject.did).toEqual(
            PresentationRequestDescriptorMocks.InspectorDid,
        );
    });

    test('validator rejects a descriptor missing a deep link', () => {
        const validator = new PublicRequestDescriptorValidator({
            requestKind: ErrorTaxonomy.RequestKindPresentation,
            expectedPath: 'inspect',
            requireDeepLink: true,
        });

        let caughtError: unknown;
        try {
            validator.validate({
                deepLink: null,
                endpoint: null,
                did: null,
            });
        } catch (error) {
            caughtError = error;
        }

        expect(caughtError).toMatchObject({
            errorCode: VCLErrorCode.InvalidLink,
            message: expect.stringContaining('deepLink was not found'),
            requestKind: ErrorTaxonomy.RequestKindPresentation,
            validationPhase: ErrorTaxonomy.PhaseLinkValidation,
        });
    });
});
