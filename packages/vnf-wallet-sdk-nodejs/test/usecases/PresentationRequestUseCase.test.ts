import { describe, test } from 'node:test';
import { expect } from 'expect';
import VCLError from '../../src/api/entities/error/VCLError';
import PresentationRequestUseCaseImpl from '../../src/impl/data/usecases/PresentationRequestUseCaseImpl';
import PresentationRequestRepositoryImpl from '../../src/impl/data/repositories/PresentationRequestRepositoryImpl';
import { PresentationRequestMocks } from '../infrastructure/resources/valid/PresentationRequestMocks';
import JwtServiceRepositoryImpl from '../../src/impl/data/repositories/JwtServiceRepositoryImpl';
import { JwtSignServiceMock } from '../infrastructure/resources/jwt/JwtSignServiceMock';
import { JwtVerifyServiceMock } from '../infrastructure/resources/jwt/JwtVerifyServiceMock';
import {
    VCLErrorCode,
    VCLPresentationRequest,
    VCLPresentationRequestDescriptor,
    VCLPushDelegate,
    VCLVerifiedProfile,
} from '../../src';
import { DeepLinkMocks } from '../infrastructure/resources/valid/DeepLinkMocks';
import { DidJwkMocks } from '../infrastructure/resources/valid/DidJwkMocks';
import PresentationRequestUseCase from '../../src/impl/domain/usecases/PresentationRequestUseCase';
import { PresentationRequestByDeepLinkVerifierImpl } from '../../src/impl/data/verifiers';
import ResolveDidDocumentRepositoryImpl from '../../src/impl/data/repositories/ResolveDidDocumentRepositoryImpl';
import { DidDocumentMocks } from '../infrastructure/resources/valid/DidDocumentMocks';
import NetworkServiceImpl from '../../src/impl/data/infrastructure/network/NetworkServiceImpl';
import { CommonMocks } from '../infrastructure/resources/CommonMocks';
import {
    mockAbsoluteGet,
    mockRegistrarGet,
    mockResolveDid,
    useNockLifecycle,
} from '../utils/nock';

describe('PresentationRequestUseCase Tests', () => {
    const pushUrl = 'push_url';
    const pushToken = 'push_token';
    const presentationRequestDescriptor = new VCLPresentationRequestDescriptor(
        DeepLinkMocks.PresentationRequestDeepLinkDevNet,
        new VCLPushDelegate(pushUrl, pushToken),
        DidJwkMocks.DidJwk,
        CommonMocks.Token,
    );
    const subject: PresentationRequestUseCase =
        new PresentationRequestUseCaseImpl(
            new PresentationRequestRepositoryImpl(new NetworkServiceImpl()),
            new ResolveDidDocumentRepositoryImpl(new NetworkServiceImpl()),
            new JwtServiceRepositoryImpl(
                new JwtSignServiceMock(''),
                new JwtVerifyServiceMock(),
            ),
            new PresentationRequestByDeepLinkVerifierImpl(),
        );

    useNockLifecycle();

    test('testGetPresentationRequestSuccess', async () => {
        const verifiedProfile = new VCLVerifiedProfile({});
        const requestScope = mockAbsoluteGet(
            presentationRequestDescriptor.endpoint!,
            JSON.parse(
                PresentationRequestMocks.EncodedPresentationRequestResponse,
            ),
        );
        const didScope = mockResolveDid(
            PresentationRequestMocks.PresentationRequest.iss,
            DidDocumentMocks.DidDocumentMock.payload,
        );

        const presentationRequest = await subject.getPresentationRequest(
            presentationRequestDescriptor,
            verifiedProfile,
        );
        const expectedPresentationRequest = new VCLPresentationRequest(
            PresentationRequestMocks.PresentationRequestJwt,
            verifiedProfile,
            DeepLinkMocks.PresentationRequestDeepLinkDevNet,
            new VCLPushDelegate(pushUrl, pushToken),
            DidJwkMocks.DidJwk,
            CommonMocks.Token,
        );

        expect(presentationRequest).toEqual(expectedPresentationRequest);
        expect(requestScope.isDone()).toBeTruthy();
        expect(didScope.isDone()).toBeTruthy();
    });

    test('testGetPresentationRequestError', async () => {
        const requestScope = mockAbsoluteGet(
            presentationRequestDescriptor.endpoint!,
            { wrong: 'payload' },
        );
        const didScope = mockRegistrarGet(
            '/api/v0.6/resolve-did/',
            DidDocumentMocks.DidDocumentMock.payload,
        );

        try {
            await subject.getPresentationRequest(
                presentationRequestDescriptor,
                new VCLVerifiedProfile({}),
            );
            expect(true).toEqual(false);
        } catch (error: any) {
            expect(error).toBeInstanceOf(VCLError);
            expect(error.errorCode).toEqual(VCLErrorCode.SdkError.toString());
        }

        expect(requestScope.isDone()).toBeTruthy();
        expect(didScope.isDone()).toBeTruthy();
    });
});
