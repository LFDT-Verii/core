import { describe, beforeEach, test } from 'node:test';
import { expect } from 'expect';
import JwtServiceRepositoryImpl from '../../src/impl/data/repositories/JwtServiceRepositoryImpl';
import { JwtSignServiceMock } from '../infrastructure/resources/jwt/JwtSignServiceMock';
import { JwtVerifyServiceMock } from '../infrastructure/resources/jwt/JwtVerifyServiceMock';
import { VCLPresentationSubmission, VCLJwt } from '../../src';
import PresentationSubmissionUseCaseImpl from '../../src/impl/data/usecases/PresentationSubmissionUseCaseImpl';
import { PresentationSubmissionMocks } from '../infrastructure/resources/valid/PresentationSubmissionMocks';
import { PresentationRequestMocks } from '../infrastructure/resources/valid/PresentationRequestMocks';
import SubmissionRepositoryImpl from '../../src/impl/data/repositories/SubmissionRepositoryImpl';
import { generatePresentationSubmissionResult } from '../infrastructure/resources/utils/Utils';
import TokenMocks from '../infrastructure/resources/valid/TokenMocks';
import PresentationSubmissionUseCase from '../../src/impl/domain/usecases/PresentationSubmissionUseCase';
import NetworkServiceImpl from '../../src/impl/data/infrastructure/network/NetworkServiceImpl';
import { mockAbsolutePost, useNockLifecycle } from '../utils/nock';

describe('PresentationSubmission Tests', () => {
    let subject: PresentationSubmissionUseCase;
    const authToken = TokenMocks.AuthToken;
    const presentationSubmission = new VCLPresentationSubmission(
        PresentationRequestMocks.PresentationRequestFeed,
        [],
    );
    const expectedSubmissionResult = generatePresentationSubmissionResult(
        PresentationSubmissionMocks.PresentationSubmissionResultJson,
        presentationSubmission.jti,
        presentationSubmission.submissionId,
    );

    beforeEach(() => {
        subject = new PresentationSubmissionUseCaseImpl(
            new SubmissionRepositoryImpl(new NetworkServiceImpl()),
            new JwtServiceRepositoryImpl(
                new JwtSignServiceMock(
                    PresentationSubmissionMocks.JwtEncodedSubmission,
                ),
                new JwtVerifyServiceMock(),
            ),
        );
    });

    useNockLifecycle();

    test('testSubmitPresentationSuccess', async () => {
        const scope = mockAbsolutePost(
            presentationSubmission.submitUri,
            presentationSubmission.generateRequestBody(
                VCLJwt.fromEncodedJwt(
                    PresentationSubmissionMocks.JwtEncodedSubmission,
                ),
            ),
            PresentationSubmissionMocks.PresentationSubmissionResultJson,
        );

        const presentationSubmissionResult = await subject.submit(
            presentationSubmission,
        );

        expect(presentationSubmissionResult).toEqual(expectedSubmissionResult);
        expect(scope.isDone()).toBeTruthy();
    });

    test('testSubmitPresentationTypeFeedSuccess', async () => {
        const scope = mockAbsolutePost(
            presentationSubmission.submitUri,
            presentationSubmission.generateRequestBody(
                VCLJwt.fromEncodedJwt(
                    PresentationSubmissionMocks.JwtEncodedSubmission,
                ),
            ),
            PresentationSubmissionMocks.PresentationSubmissionResultJson,
            200,
            {
                authorization: `Bearer ${authToken.accessToken?.value}`,
            },
        );

        const presentationSubmissionResult = await subject.submit(
            presentationSubmission,
            authToken,
        );

        expect(presentationSubmissionResult).toEqual(expectedSubmissionResult);
        expect(scope.isDone()).toBeTruthy();
    });
});
