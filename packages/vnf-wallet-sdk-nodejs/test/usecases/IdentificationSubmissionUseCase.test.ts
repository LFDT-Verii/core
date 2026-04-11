import { describe, test, mock } from 'node:test';
import { expect } from 'expect';
import JwtServiceRepositoryImpl from '../../src/impl/data/repositories/JwtServiceRepositoryImpl';
import { JwtSignServiceMock } from '../infrastructure/resources/jwt/JwtSignServiceMock';
import { JwtVerifyServiceMock } from '../infrastructure/resources/jwt/JwtVerifyServiceMock';
import {
    Dictionary,
    VCLExchange,
    VCLJwt,
    VCLSubmissionResult,
    VCLToken,
} from '../../src';
import { PresentationSubmissionMocks } from '../infrastructure/resources/valid/PresentationSubmissionMocks';
import SubmissionRepositoryImpl from '../../src/impl/data/repositories/SubmissionRepositoryImpl';
import IdentificationSubmissionUseCaseImpl from '../../src/impl/data/usecases/IdentificationSubmissionUseCaseImpl';
import VCLIdentificationSubmission from '../../src/api/entities/VCLIdentificationSubmission';
import { IdentificationSubmissionMocks } from '../infrastructure/resources/valid/IdentificationSubmissionMocks';
import VCLJwtDescriptor from '../../src/api/entities/VCLJwtDescriptor';
import NetworkServiceImpl from '../../src/impl/data/infrastructure/network/NetworkServiceImpl';
import { mockAbsolutePost, useNockLifecycle } from '../utils/nock';

describe('PresentationSubmission Tests', () => {
    const jwtSignServiceMock = new JwtSignServiceMock();
    jwtSignServiceMock.sign = mock.fn(() =>
        Promise.resolve(
            VCLJwt.fromEncodedJwt(
                PresentationSubmissionMocks.JwtEncodedSubmission,
            ),
        ),
    );
    const jwtVerifyServiceMock = new JwtVerifyServiceMock();
    const jwtServiceRepository = new JwtServiceRepositoryImpl(
        jwtSignServiceMock,
        jwtVerifyServiceMock,
    );
    const submissionRepository = new SubmissionRepositoryImpl(
        new NetworkServiceImpl(),
    );
    const subject = new IdentificationSubmissionUseCaseImpl(
        submissionRepository,
        jwtServiceRepository,
    );
    const identificationSubmission = new VCLIdentificationSubmission(
        IdentificationSubmissionMocks.CredentialManifest,
        IdentificationSubmissionMocks.IdentificationList,
    );

    const expectedExchange = (
        exchangeJsonObj: Dictionary<any>,
    ): VCLExchange => {
        return new VCLExchange(
            exchangeJsonObj[VCLExchange.KeyId],
            exchangeJsonObj[VCLExchange.KeyType],
            exchangeJsonObj[VCLExchange.KeyDisclosureComplete],
            exchangeJsonObj[VCLExchange.KeyExchangeComplete],
        );
    };
    const generateIdentificationSubmissionResult = (
        jsonObj: Dictionary<any>,
        jti: string,
        submissionId: string,
    ): VCLSubmissionResult => {
        const exchangeJsonObj = jsonObj[VCLSubmissionResult.KeyExchange];
        return new VCLSubmissionResult(
            new VCLToken(jsonObj[VCLSubmissionResult.KeyToken]),
            expectedExchange(exchangeJsonObj),
            jti,
            submissionId,
        );
    };
    const expectedPresentationSubmissionResult =
        generateIdentificationSubmissionResult(
            PresentationSubmissionMocks.PresentationSubmissionResultJson,
            identificationSubmission.jti,
            identificationSubmission.submissionId,
        );

    useNockLifecycle();

    test('testIdentificationSubmissionDidJwk', async () => {
        expect(
            IdentificationSubmissionMocks.CredentialManifest.didJwk,
        ).toStrictEqual(IdentificationSubmissionMocks.DidJwk);
        expect(identificationSubmission.didJwk).toStrictEqual(
            IdentificationSubmissionMocks.DidJwk,
        );
    });

    test('testIdentificationSubmissionSuccess', async () => {
        const scope = mockAbsolutePost(
            identificationSubmission.submitUri,
            identificationSubmission.generateRequestBody(
                VCLJwt.fromEncodedJwt(
                    PresentationSubmissionMocks.JwtEncodedSubmission,
                ),
            ),
            PresentationSubmissionMocks.PresentationSubmissionResultJson,
        );

        const identificationSubmissionResult = await subject.submit(
            identificationSubmission,
        );

        expect(jwtSignServiceMock.sign.mock.callCount()).toEqual(1);
        expect(jwtSignServiceMock.sign.mock.calls[0].arguments).toEqual([
            new VCLJwtDescriptor(
                identificationSubmission.generatePayload(
                    identificationSubmission.didJwk.did,
                ),
                identificationSubmission.jti,
                identificationSubmission.didJwk.did,
            ),
            identificationSubmission.didJwk,
            null,
            identificationSubmission.remoteCryptoServicesToken,
        ]);

        expect(identificationSubmissionResult).toEqual(
            expectedPresentationSubmissionResult,
        );
        expect(scope.isDone()).toBeTruthy();
    });
});
