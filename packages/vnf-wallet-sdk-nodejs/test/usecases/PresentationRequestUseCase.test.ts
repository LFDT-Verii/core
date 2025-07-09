import PresentationRequestUseCaseImpl from '../../src/impl/data/usecases/PresentationRequestUseCaseImpl';
import PresentationRequestRepositoryImpl from '../../src/impl/data/repositories/PresentationRequestRepositoryImpl';
import NetworkServiceSuccess from '../infrastructure/resources/network/NetworkServiceSuccess';
import { PresentationRequestMocks } from '../infrastructure/resources/valid/PresentationRequestMocks';
import JwtServiceRepositoryImpl from '../../src/impl/data/repositories/JwtServiceRepositoryImpl';
import { JwtSignServiceMock } from '../infrastructure/resources/jwt/JwtSignServiceMock';
import { JwtVerifyServiceMock } from '../infrastructure/resources/jwt/JwtVerifyServiceMock';
import {
    VCLErrorCode,
    VCLPresentationRequestDescriptor,
    VCLPushDelegate,
    VCLToken,
    VCLVerifiedProfile,
} from '../../src';
import { DeepLinkMocks } from '../infrastructure/resources/valid/DeepLinkMocks';
import { DidJwkMocks } from '../infrastructure/resources/valid/DidJwkMocks';
import PresentationRequestUseCase from '../../src/impl/domain/usecases/PresentationRequestUseCase';
import { PresentationRequestByDeepLinkVerifierImpl } from '../../src/impl/data/verifiers';
import ResolveDidDocumentRepositoryImpl from '../../src/impl/data/repositories/ResolveDidDocumentRepositoryImpl';
import { DidDocumentMocks } from '../infrastructure/resources/valid/DidDocumentMocks';

describe('PresentationRequestUseCase Tests', () => {
    let subject1: PresentationRequestUseCase;
    let subject2: PresentationRequestUseCase;

    test('testGetPresentationRequestSuccess', async () => {
        const pushUrl = 'push_url';
        const pushToken = 'push_token';
        subject1 = new PresentationRequestUseCaseImpl(
            new PresentationRequestRepositoryImpl(
                new NetworkServiceSuccess(
                    JSON.parse(
                        PresentationRequestMocks.EncodedPresentationRequestResponse
                    )
                )
            ),
            new ResolveDidDocumentRepositoryImpl(
                new NetworkServiceSuccess(
                    DidDocumentMocks.DidDocumentMock.payload
                )
            ),
            new JwtServiceRepositoryImpl(
                new JwtSignServiceMock(''),
                new JwtVerifyServiceMock()
            ),
            new PresentationRequestByDeepLinkVerifierImpl()
        );

        const presentationRequest = await subject1.getPresentationRequest(
            new VCLPresentationRequestDescriptor(
                DeepLinkMocks.PresentationRequestDeepLinkDevNet,
                new VCLPushDelegate(pushUrl, pushToken),
                DidJwkMocks.DidJwk,
                new VCLToken('some token')
            ),
            new VCLVerifiedProfile({})
        );
        expect(presentationRequest.jwt).toStrictEqual(
            PresentationRequestMocks.PresentationRequestJwt
        );
        expect(presentationRequest.pushDelegate?.pushUrl).toEqual(pushUrl);
        expect(presentationRequest.pushDelegate?.pushToken).toEqual(pushToken);
        expect(presentationRequest.didJwk).toStrictEqual(DidJwkMocks.DidJwk);
        expect(presentationRequest.remoteCryptoServicesToken?.value).toEqual(
            'some token'
        );
    });

    test('testGetPresentationRequestError', async () => {
        const pushUrl = 'push_url';
        const pushToken = 'push_token';
        subject2 = new PresentationRequestUseCaseImpl(
            new PresentationRequestRepositoryImpl(
                new NetworkServiceSuccess(JSON.parse('{"wrong": "payload"}'))
            ),
            new ResolveDidDocumentRepositoryImpl(
                new NetworkServiceSuccess(
                    DidDocumentMocks.DidDocumentMock.payload
                )
            ),
            new JwtServiceRepositoryImpl(
                new JwtSignServiceMock(''),
                new JwtVerifyServiceMock()
            ),
            new PresentationRequestByDeepLinkVerifierImpl()
        );
        try {
            await subject2.getPresentationRequest(
                new VCLPresentationRequestDescriptor(
                    DeepLinkMocks.PresentationRequestDeepLinkDevNet,
                    new VCLPushDelegate(pushUrl, pushToken),
                    DidJwkMocks.DidJwk,
                    new VCLToken('some token')
                ),
                new VCLVerifiedProfile({})
            );
            expect(true).toEqual(false);
        } catch (error: any) {
            expect(error.errorCode).toEqual(VCLErrorCode.SdkError.toString());
        }
    });
});
