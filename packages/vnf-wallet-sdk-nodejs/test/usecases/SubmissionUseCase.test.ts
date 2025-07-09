import { expect } from '@jest/globals';
import NetworkServiceSuccess from '../infrastructure/resources/network/NetworkServiceSuccess';
import JwtServiceRepositoryImpl from '../../src/impl/data/repositories/JwtServiceRepositoryImpl';
import { JwtSignServiceMock } from '../infrastructure/resources/jwt/JwtSignServiceMock';
import { JwtVerifyServiceMock } from '../infrastructure/resources/jwt/JwtVerifyServiceMock';
import {
    VCLDeepLink,
    VCLPresentationRequest,
    VCLPresentationSubmission,
    VCLVerifiedProfile,
} from '../../src';
import { DidJwkMocks } from '../infrastructure/resources/valid/DidJwkMocks';
import PresentationSubmissionUseCaseImpl from '../../src/impl/data/usecases/PresentationSubmissionUseCaseImpl';
import { PresentationSubmissionMocks } from '../infrastructure/resources/valid/PresentationSubmissionMocks';
import SubmissionRepositoryImpl from '../../src/impl/data/repositories/SubmissionRepositoryImpl';
import { CommonMocks } from '../infrastructure/resources/CommonMocks';
import { generatePresentationSubmissionResult } from '../infrastructure/resources/utils/Utils';
import TokenMocks from '../infrastructure/resources/valid/TokenMocks';
import PresentationSubmissionUseCase from '../../src/impl/domain/usecases/PresentationSubmissionUseCase';
import {
    HeaderKeys,
    HeaderValues,
} from '../../src/impl/data/repositories/Urls';

describe('PresentationSubmission Tests', () => {
    let subject: PresentationSubmissionUseCase;
    let networkServiceSuccess: NetworkServiceSuccess;
    const didJwk = DidJwkMocks.DidJwk;
    const authToken = TokenMocks.AuthToken;
    const presentationSubmission = new VCLPresentationSubmission(
        new VCLPresentationRequest(
            CommonMocks.JWT,
            new VCLVerifiedProfile({}),
            new VCLDeepLink(''),
            null,
            didJwk
        ),
        []
    );
    const expectedSubmissionResult = generatePresentationSubmissionResult(
        PresentationSubmissionMocks.PresentationSubmissionResultJson,
        presentationSubmission.jti,
        presentationSubmission.submissionId
    );

    const expectedHeadersWithoutAccessToken = {
        [HeaderKeys.XVnfProtocolVersion]: HeaderValues.XVnfProtocolVersion,
    };
    const expectedHeadersWithAccessToken = {
        [HeaderKeys.XVnfProtocolVersion]: HeaderValues.XVnfProtocolVersion,
        [HeaderKeys.Authorization]: `Bearer ${authToken.accessToken?.value}`,
    };

    beforeEach(() => {
        networkServiceSuccess = new NetworkServiceSuccess(
            PresentationSubmissionMocks.PresentationSubmissionResultJson
        );
        subject = new PresentationSubmissionUseCaseImpl(
            new SubmissionRepositoryImpl(networkServiceSuccess),
            new JwtServiceRepositoryImpl(
                new JwtSignServiceMock(
                    PresentationSubmissionMocks.JwtEncodedSubmission
                ),
                new JwtVerifyServiceMock()
            )
        );
    });

    test('testSubmitPresentationSuccess', async () => {
        const presentationSubmissionResult = await subject.submit(
            presentationSubmission
        );

        expect(presentationSubmissionResult).toEqual(expectedSubmissionResult);

        expect(networkServiceSuccess.sendRequestCalled).toEqual(true);
        expect(networkServiceSuccess.request).toBeDefined();
        expect(networkServiceSuccess.request!.headers).toEqual(
            expectedHeadersWithoutAccessToken
        );
    });

    test('testSubmitPresentationTypeFeedSuccess', async () => {
        const presentationSubmissionResult = await subject.submit(
            presentationSubmission,
            authToken
        );

        expect(presentationSubmissionResult).toEqual(expectedSubmissionResult);

        expect(networkServiceSuccess.sendRequestCalled).toEqual(true);
        expect(networkServiceSuccess.request).toBeDefined();
        expect(networkServiceSuccess.request!.headers!).toEqual(
            expectedHeadersWithAccessToken
        );
    });
});
