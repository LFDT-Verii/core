import { expect } from '@jest/globals';
import NetworkServiceSuccess from '../infrastructure/resources/network/NetworkServiceSuccess';
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

describe('PresentationSubmission Tests', () => {
    const jwtSignServiceMock = new JwtSignServiceMock();
    jwtSignServiceMock.sign = jest
        .fn()
        .mockResolvedValue(
            Promise.resolve(
                VCLJwt.fromEncodedJwt(
                    PresentationSubmissionMocks.JwtEncodedSubmission
                )
            )
        );
    const jwtVerifyServiceMock = new JwtVerifyServiceMock();
    const jwtServiceRepository = new JwtServiceRepositoryImpl(
        jwtSignServiceMock,
        jwtVerifyServiceMock
    );
    const submissionRepository = new SubmissionRepositoryImpl(
        new NetworkServiceSuccess(
            PresentationSubmissionMocks.PresentationSubmissionResultJson
        )
    );
    const subject = new IdentificationSubmissionUseCaseImpl(
        submissionRepository,
        jwtServiceRepository
    );
    const identificationSubmission = new VCLIdentificationSubmission(
        IdentificationSubmissionMocks.CredentialManifest,
        IdentificationSubmissionMocks.IdentificationList
    );

    const expectedExchange = (
        exchangeJsonObj: Dictionary<any>
    ): VCLExchange => {
        return new VCLExchange(
            exchangeJsonObj[VCLExchange.KeyId],
            exchangeJsonObj[VCLExchange.KeyType],
            exchangeJsonObj[VCLExchange.KeyDisclosureComplete],
            exchangeJsonObj[VCLExchange.KeyExchangeComplete]
        );
    };
    const generateIdentificationSubmissionResult = (
        jsonObj: Dictionary<any>,
        jti: string,
        submissionId: string
    ): VCLSubmissionResult => {
        const exchangeJsonObj = jsonObj[VCLSubmissionResult.KeyExchange];
        return new VCLSubmissionResult(
            new VCLToken(jsonObj[VCLSubmissionResult.KeyToken]),
            expectedExchange(exchangeJsonObj),
            jti,
            submissionId
        );
    };
    const expectedPresentationSubmissionResult =
        generateIdentificationSubmissionResult(
            PresentationSubmissionMocks.PresentationSubmissionResultJson,
            identificationSubmission.jti,
            identificationSubmission.submissionId
        );

    test('testIdentificationSubmissionDidJwk', async () => {
        expect(
            IdentificationSubmissionMocks.CredentialManifest.didJwk
        ).toStrictEqual(IdentificationSubmissionMocks.DidJwk);
        expect(identificationSubmission.didJwk).toStrictEqual(
            IdentificationSubmissionMocks.DidJwk
        );
    });

    test('testIdentificationSubmissionSuccess', async () => {
        const identificationSubmissionResult = await subject.submit(
            identificationSubmission
        );

        expect(jwtSignServiceMock.sign).toHaveBeenCalledTimes(1);
        expect(jwtSignServiceMock.sign).toHaveBeenCalledWith(
            new VCLJwtDescriptor(
                identificationSubmission.generatePayload(
                    identificationSubmission.didJwk.did
                ),
                identificationSubmission.jti,
                identificationSubmission.didJwk.did
            ),
            identificationSubmission.didJwk,
            null,
            identificationSubmission.remoteCryptoServicesToken
        );

        expect(identificationSubmissionResult).toEqual(
            expectedPresentationSubmissionResult
        );
    });
});
