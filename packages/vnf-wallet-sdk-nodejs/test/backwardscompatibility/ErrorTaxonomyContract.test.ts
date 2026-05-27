/* eslint-disable no-await-in-loop */
import { beforeEach, describe, test } from 'node:test';
import { expect } from 'expect';
import nock from 'nock';
import {
    VCLEnvironment,
    VCLError,
    VCLErrorCode,
    VCLCredentialManifest,
    VCLCredentialManifestDescriptor,
    VCLCredentialManifestDescriptorByDeepLink,
    VCLCredentialManifestDescriptorByService,
    VCLCryptoServicesDescriptor,
    VCLDeepLink,
    VCLInitializationDescriptor,
    VCLIssuingType,
    VCLJwt,
    VCLJwtVerifyService,
    VCLPresentationRequestDescriptor,
    VCLPublicJwk,
    VCLService,
    VCLStatusCode,
    VCLToken,
    VCLXVnfProtocolVersion,
} from '../../src';
import { VCLImpl } from '../../src/impl/VCLImpl';
import GlobalConfig from '../../src/impl/GlobalConfig';
import Request from '../../src/impl/data/infrastructure/network/Request';
import NetworkServiceImpl from '../../src/impl/data/infrastructure/network/NetworkServiceImpl';
import CredentialManifestRepositoryImpl from '../../src/impl/data/repositories/CredentialManifestRepositoryImpl';
import JwtServiceRepositoryImpl from '../../src/impl/data/repositories/JwtServiceRepositoryImpl';
import PresentationRequestRepositoryImpl from '../../src/impl/data/repositories/PresentationRequestRepositoryImpl';
import ResolveDidDocumentRepositoryImpl from '../../src/impl/data/repositories/ResolveDidDocumentRepositoryImpl';
import VerifiedProfileRepositoryImpl from '../../src/impl/data/repositories/VerifiedProfileRepositoryImpl';
import CredentialManifestUseCaseImpl from '../../src/impl/data/usecases/CredentialManifestUseCaseImpl';
import PresentationRequestUseCaseImpl from '../../src/impl/data/usecases/PresentationRequestUseCaseImpl';
import VerifiedProfileUseCaseImpl from '../../src/impl/data/usecases/VerifiedProfileUseCaseImpl';
import {
    CredentialManifestByDeepLinkVerifierImpl,
    PresentationRequestByDeepLinkVerifierImpl,
} from '../../src/impl/data/verifiers';
import VelocityDeepLinkValidator from '../../src/impl/utils/VelocityDeepLinkValidator';
import { ProfileServiceTypeVerifier } from '../../src/impl/utils/ProfileServiceTypeVerifier';
import { JwtSignServiceMock } from '../infrastructure/resources/jwt/JwtSignServiceMock';
import { KeyServiceMock } from '../infrastructure/resources/key/KeyServiceMock';
import { CredentialManifestMocks } from '../infrastructure/resources/valid/CredentialManifestMocks';
import { DeepLinkMocks } from '../infrastructure/resources/valid/DeepLinkMocks';
import { DidDocumentMocks } from '../infrastructure/resources/valid/DidDocumentMocks';
import { DidJwkMocks } from '../infrastructure/resources/valid/DidJwkMocks';
import { ErrorMocks } from '../infrastructure/resources/valid/ErrorMocks';
import { PresentationRequestMocks } from '../infrastructure/resources/valid/PresentationRequestMocks';
import { VerifiedProfileMocks } from '../infrastructure/resources/valid/VerifiedProfileMocks';
import { mockRegistrarGet, useNockLifecycle } from '../utils/nock';

const jsonContentType = Request.ContentTypeApplicationJson;
const registrarOrigin = 'https://registrar.velocitynetwork.foundation';

type EntryPoint = {
    defaultDeepLink: VCLDeepLink;
    did: string;
    didParam: string;
    didUnresolvableCode: string;
    encodedRequestUri: string;
    lastDid: string;
    legacyMismatchErrorCode: string;
    notRegisteredCode: string;
    otherDidParam: string;
    requestInvalidCode: string;
    requestKind: string;
    requestUnauthorizedCode: string;
    schemePath: string;
    type: 'issuing' | 'presentation';
};

type BaselineRouter = {
    didDocumentContentType?: string;
    didDocumentPayload?: unknown;
    didDocumentStatusCode?: number;
    requestContentType?: string;
    requestFailure?: Error;
    requestPayload?: unknown;
    requestStatusCode?: number;
    verifiedProfileContentType?: string;
    verifiedProfilePayload?: unknown;
    verifiedProfileStatusCode?: number;
};

type CapturedRequest = {
    urls: string[];
};

type ErrorDiagnostics = {
    payload?: string | null;
    error?: string | null;
    errorCode: string;
    sourceErrorCode?: string | null;
    requestId?: string | null;
    statusCode?: number | null;
    validationPhase?: string | null;
    requestDid?: string | null;
    requestUri?: string | null;
    requestKind?: string | null;
};

describe('Error taxonomy contract', () => {
    useNockLifecycle();

    beforeEach(() => {
        GlobalConfig.init(
            false,
            VCLEnvironment.Prod,
            VCLXVnfProtocolVersion.XVnfProtocolVersion1,
            true,
        );
    });

    test('malformed links and missing required params return sdk_error', async () => {
        for (const entryPoint of entryPoints) {
            const missingDidDeepLink = new VCLDeepLink(
                `velocity-network://${entryPoint.schemePath}`,
            );

            for (const [deepLink, sourceErrorCode] of [
                [
                    new VCLDeepLink('not a url'),
                    VelocityDeepLinkValidator.SourceUnparseablePayload,
                ],
                [
                    missingDidDeepLink,
                    VelocityDeepLinkValidator.SourceInvalidOrMissingDid,
                ],
            ] as const) {
                const error = await getEntryPointError(entryPoint, deepLink);

                assertDiagnostics(
                    expectedDiagnostics(entryPoint, {
                        errorCode: VCLErrorCode.InvalidLink,
                        sourceErrorCode,
                        validationPhase: 'link_validation',
                        requestUri: deepLink.requestUri,
                    }),
                    error,
                );
            }
        }
    });

    test('unsupported scheme with known query params returns null endpoint sdk_error', async () => {
        for (const entryPoint of entryPoints) {
            const deepLink = new VCLDeepLink(
                `https://example.com/${entryPoint.schemePath}?${entryPoint.didParam}=did:example:entity`,
            );
            const error = await getEntryPointError(entryPoint, deepLink);

            assertDiagnostics(
                expectedDiagnostics(entryPoint, {
                    errorCode: VCLErrorCode.InvalidLink,
                    sourceErrorCode:
                        VelocityDeepLinkValidator.SourceUnsupportedVelocityLink,
                    validationPhase: 'link_validation',
                    requestUri: deepLink.requestUri,
                }),
                error,
            );
        }
    });

    test('unsupported flow path returns invalid link', async () => {
        for (const entryPoint of entryPoints) {
            const deepLink = new VCLDeepLink(
                `velocity-network://unknown-flow?request_uri=${entryPoint.encodedRequestUri}&${entryPoint.didParam}=did:example:entity`,
            );
            const error = await getEntryPointError(entryPoint, deepLink);

            assertDiagnostics(
                expectedDiagnostics(entryPoint, {
                    errorCode: VCLErrorCode.InvalidLink,
                    sourceErrorCode:
                        VelocityDeepLinkValidator.SourceUnsupportedVelocityLink,
                    validationPhase: 'link_validation',
                    requestUri: deepLink.requestUri,
                }),
                error,
            );
        }
    });

    test('wrong flow did param is accepted by lax did parsing and fails request verification', async () => {
        for (const entryPoint of entryPoints) {
            const deepLink = new VCLDeepLink(
                `velocity-network://${entryPoint.schemePath}?request_uri=${simpleRequestUri()}&${entryPoint.otherDidParam}=did:example:entity`,
            );
            const error = await getEntryPointError(entryPoint, deepLink);

            assertDiagnostics(
                expectedDiagnostics(entryPoint, {
                    errorCode: entryPoint.requestInvalidCode,
                    sourceErrorCode: entryPoint.legacyMismatchErrorCode,
                    validationPhase: 'request_validation',
                    requestDid: entryPoint.did,
                }),
                error,
            );
        }
    });

    test('undecodable query params throw before sdk entry point', () => {
        for (const deepLinkValue of [
            'velocity-network://issue?request_uri=%',
            'velocity-network://inspect?request_uri=%',
        ]) {
            expect(() => new VCLDeepLink(deepLinkValue)).toThrow(URIError);
        }
    });

    test('missing request_uri produces endpoint null sdk_errors', async () => {
        for (const entryPoint of entryPoints) {
            const deepLink = new VCLDeepLink(
                `velocity-network://${entryPoint.schemePath}?${entryPoint.didParam}=did:example:entity`,
            );
            const error = await getEntryPointError(entryPoint, deepLink);

            assertDiagnostics(
                expectedDiagnostics(entryPoint, {
                    errorCode: VCLErrorCode.InvalidLink,
                    sourceErrorCode:
                        VelocityDeepLinkValidator.SourceInvalidOrMissingRequestUri,
                    validationPhase: 'link_validation',
                    requestUri: null,
                }),
                error,
            );
        }
    });

    test('malformed and disallowed request_uri values return invalid link', async () => {
        for (const entryPoint of entryPoints) {
            const malformedRequestUriDeepLink = new VCLDeepLink(
                `velocity-network://${entryPoint.schemePath}?request_uri=not-a-url&${entryPoint.didParam}=did:example:entity`,
            );
            const disallowedSchemeDeepLink = new VCLDeepLink(
                `velocity-network://${entryPoint.schemePath}?request_uri=ftp%3A%2F%2Fexample.com%2Frequest&${entryPoint.didParam}=did:example:entity`,
            );

            for (const deepLink of [
                malformedRequestUriDeepLink,
                disallowedSchemeDeepLink,
            ]) {
                const error = await getEntryPointError(entryPoint, deepLink);

                assertDiagnostics(
                    expectedDiagnostics(entryPoint, {
                        errorCode: VCLErrorCode.InvalidLink,
                        sourceErrorCode:
                            VelocityDeepLinkValidator.SourceInvalidOrMissingRequestUri,
                        validationPhase: 'link_validation',
                        requestUri: deepLink.requestUri,
                    }),
                    error,
                );
            }
        }
    });

    test('invalid direct request endpoint returns invalid link', async () => {
        const entryPoint = issuingEntryPoint();
        const endpoint = 'ftp://example.com/request';
        const error = await getCredentialManifestDescriptorError(
            credentialManifestDescriptorByService({ endpoint }),
            {},
            undefined,
            false,
        );

        assertDiagnostics(
            expectedDiagnostics(entryPoint, {
                errorCode: VCLErrorCode.InvalidLink,
                sourceErrorCode:
                    VelocityDeepLinkValidator.SourceInvalidOrMissingRequestEndpoint,
                validationPhase: 'link_validation',
                requestUri: endpoint,
            }),
            error,
        );
    });

    test('missing direct request did returns invalid link', async () => {
        const entryPoint = issuingEntryPoint();
        const error = await getCredentialManifestDescriptorError(
            credentialManifestDescriptorByService({ did: '' }),
            {},
            undefined,
            false,
        );

        assertDiagnostics(
            expectedDiagnostics(entryPoint, {
                errorCode: VCLErrorCode.InvalidLink,
                validationPhase: 'link_validation',
            }),
            error,
        );
        expect(error.message).toContain('did was not found');
    });

    test('malformed did syntax returns invalid link', async () => {
        for (const entryPoint of entryPoints) {
            for (const did of [
                'not-a-did',
                'did:',
                'did:example',
                'did:Example:entity',
            ]) {
                const deepLink = new VCLDeepLink(
                    `velocity-network://${entryPoint.schemePath}?request_uri=${entryPoint.encodedRequestUri}&${entryPoint.didParam}=${did}`,
                );
                const error = await getEntryPointError(entryPoint, deepLink);

                assertDiagnostics(
                    expectedDiagnostics(entryPoint, {
                        errorCode: VCLErrorCode.InvalidLink,
                        sourceErrorCode:
                            VelocityDeepLinkValidator.SourceInvalidOrMissingDid,
                        validationPhase: 'link_validation',
                        requestUri: deepLink.requestUri,
                    }),
                    error,
                );
            }
        }
    });

    test('transport failure returns sdk_error with network status only', async () => {
        for (const entryPoint of entryPoints) {
            const error = await getEntryPointError(entryPoint, undefined, {
                requestFailure: new Error('offline'),
            });

            assertDiagnostics(
                expectedDiagnostics(entryPoint, {
                    errorCode: VCLErrorCode.ConnectivityFailure,
                    statusCode: VCLStatusCode.NetworkError,
                    validationPhase: 'client_request_fetch',
                    requestUri: entryPoint.defaultDeepLink.requestUri,
                }),
                error,
            );
            expect(error.message).toContain('offline');
        }
    });

    test('request endpoint 401 and 403 preserve http status and payload error code', async () => {
        for (const entryPoint of entryPoints) {
            for (const statusCode of [401, 403]) {
                const error = await getEntryPointError(entryPoint, undefined, {
                    requestStatusCode: statusCode,
                    requestPayload: ErrorMocks.Payload,
                    requestContentType: jsonContentType,
                });

                assertDiagnostics(
                    expectedDiagnostics(entryPoint, {
                        payload: ErrorMocks.Payload,
                        error: ErrorMocks.Error,
                        errorCode: VCLErrorCode.ClientRequestUnauthorized,
                        sourceErrorCode: ErrorMocks.ErrorCode,
                        requestId: ErrorMocks.RequestId,
                        statusCode,
                        validationPhase: 'client_request_fetch',
                        requestUri: entryPoint.defaultDeepLink.requestUri,
                    }),
                    error,
                );
                expect(error.message).toEqual(ErrorMocks.Message);
            }
        }
    });

    test('request endpoint rejections preserve http status when payload has no statusCode', async () => {
        const { statusCode: _statusCode, ...payloadWithoutStatusCode } =
            JSON.parse(ErrorMocks.Payload);
        const payload = JSON.stringify(payloadWithoutStatusCode);

        for (const entryPoint of entryPoints) {
            for (const statusCode of [400, 404, 409, 410, 422, 500, 502]) {
                const error = await getEntryPointError(entryPoint, undefined, {
                    requestStatusCode: statusCode,
                    requestPayload: payload,
                    requestContentType: jsonContentType,
                });

                assertDiagnostics(
                    expectedDiagnostics(entryPoint, {
                        payload,
                        error: ErrorMocks.Error,
                        errorCode: VCLErrorCode.ClientRequestRejected,
                        sourceErrorCode: ErrorMocks.ErrorCode,
                        requestId: ErrorMocks.RequestId,
                        statusCode,
                        validationPhase: 'client_request_fetch',
                        requestUri: entryPoint.defaultDeepLink.requestUri,
                    }),
                    error,
                );
            }
        }
    });

    test('plain text request endpoint rejections default to sdk_error with http status and payload message', async () => {
        for (const entryPoint of entryPoints) {
            const error = await getEntryPointError(entryPoint, undefined, {
                requestStatusCode: 500,
                requestPayload: 'plain text failure',
                requestContentType: 'text/plain',
            });

            assertDiagnostics(
                expectedDiagnostics(entryPoint, {
                    payload: 'plain text failure',
                    errorCode: VCLErrorCode.ClientRequestRejected,
                    sourceErrorCode: VCLErrorCode.SdkError,
                    statusCode: 500,
                    validationPhase: 'client_request_fetch',
                    requestUri: entryPoint.defaultDeepLink.requestUri,
                }),
                error,
            );
            expect(error.message).toEqual('plain text failure');
            expect(error.payload).toEqual('plain text failure');
        }
    });

    test('json request endpoint rejections without errorCode default to sdk_error', async () => {
        const { errorCode: _errorCode, ...payloadWithoutErrorCode } =
            JSON.parse(ErrorMocks.Payload);
        const payload = JSON.stringify(payloadWithoutErrorCode);

        for (const entryPoint of entryPoints) {
            const error = await getEntryPointError(entryPoint, undefined, {
                requestStatusCode: 422,
                requestPayload: payload,
                requestContentType: jsonContentType,
            });

            assertDiagnostics(
                expectedDiagnostics(entryPoint, {
                    payload,
                    error: ErrorMocks.Error,
                    errorCode: VCLErrorCode.ClientRequestRejected,
                    sourceErrorCode: VCLErrorCode.SdkError,
                    requestId: ErrorMocks.RequestId,
                    statusCode: 422,
                    validationPhase: 'client_request_fetch',
                    requestUri: entryPoint.defaultDeepLink.requestUri,
                }),
                error,
            );
            expect(error.message).toEqual(ErrorMocks.Message);
        }
    });

    test('empty request endpoint response returns sdk_error', async () => {
        for (const entryPoint of entryPoints) {
            const error = await getEntryPointError(entryPoint, undefined, {
                requestPayload: '',
            });

            assertDiagnostics(
                expectedDiagnostics(entryPoint, {
                    errorCode: VCLErrorCode.ClientRequestRejected,
                    sourceErrorCode: VCLErrorCode.SdkError,
                    validationPhase: 'client_request_fetch',
                    requestUri: entryPoint.defaultDeepLink.requestUri,
                }),
                error,
            );
        }
    });

    test('malformed request endpoint response returns sdk_error', async () => {
        for (const entryPoint of entryPoints) {
            const error = await getEntryPointError(entryPoint, undefined, {
                requestPayload: 'not json',
            });

            assertDiagnostics(
                expectedDiagnostics(entryPoint, {
                    errorCode: VCLErrorCode.ClientRequestRejected,
                    sourceErrorCode: VCLErrorCode.SdkError,
                    validationPhase: 'client_request_fetch',
                    requestUri: entryPoint.defaultDeepLink.requestUri,
                }),
                error,
            );
        }
    });

    test('missing expected request fields return sdk_error after empty jwt is decoded', async () => {
        for (const entryPoint of entryPoints) {
            const error = await getEntryPointError(entryPoint, undefined, {
                requestPayload: {},
            });

            assertDiagnostics(
                expectedDiagnostics(entryPoint, {
                    errorCode: VCLErrorCode.ClientRequestRejected,
                    sourceErrorCode: VCLErrorCode.SdkError,
                    validationPhase: 'client_request_fetch',
                    requestUri: entryPoint.defaultDeepLink.requestUri,
                }),
                error,
            );
        }
    });

    test('empty issuing_request returns sdk_error after request fetch', async () => {
        const error = await getCredentialManifestDescriptorError(
            credentialManifestDescriptorByService(),
            {
                requestPayload: {
                    issuing_request: '',
                },
            },
        );

        assertDiagnostics(
            expectedDiagnostics(issuingEntryPoint(), {
                errorCode: VCLErrorCode.ClientRequestRejected,
                sourceErrorCode: VCLErrorCode.SdkError,
                validationPhase: 'client_request_fetch',
                requestUri:
                    credentialManifestDescriptorByService().endpoint ?? null,
            }),
            error,
        );
        expect(error.message).toEqual('Missing issuing_request');
    });

    test('did resolution network failure propagates sdk_error and status from network', async () => {
        for (const entryPoint of entryPoints) {
            const payload =
                '{"message":"resolve failed","errorCode":"sdk_error"}';
            const error = await getEntryPointError(entryPoint, undefined, {
                didDocumentStatusCode: 404,
                didDocumentPayload: payload,
                didDocumentContentType: jsonContentType,
            });

            assertDiagnostics(
                expectedDiagnostics(entryPoint, {
                    payload,
                    errorCode: entryPoint.didUnresolvableCode,
                    sourceErrorCode: VCLErrorCode.SdkError,
                    statusCode: 404,
                    validationPhase: 'did_resolution',
                    requestDid: entryPoint.did,
                }),
                error,
            );
            expect(error.message).toEqual('resolve failed');
        }
    });

    test('invalid did document shape returns did unresolvable at did resolution', async () => {
        for (const entryPoint of entryPoints) {
            const error = await getEntryPointError(entryPoint, undefined, {
                didDocumentPayload: 'not json',
            });

            assertDiagnostics(
                expectedDiagnostics(entryPoint, {
                    errorCode: entryPoint.didUnresolvableCode,
                    sourceErrorCode: VCLErrorCode.SdkError,
                    validationPhase: 'did_resolution',
                    requestDid: entryPoint.did,
                }),
                error,
            );
            expect(error.message).toContain('public jwk not found for kid');
        }
    });

    test('did document lacking required verification material returns did unresolvable at did resolution', async () => {
        for (const entryPoint of entryPoints) {
            for (const didDocumentPayload of [
                {},
                {
                    ...DidDocumentMocks.DidDocumentMock.payload,
                    verificationMethod: [],
                },
            ]) {
                const error = await getEntryPointError(entryPoint, undefined, {
                    didDocumentPayload,
                });

                assertDiagnostics(
                    expectedDiagnostics(entryPoint, {
                        errorCode: entryPoint.didUnresolvableCode,
                        sourceErrorCode: VCLErrorCode.SdkError,
                        validationPhase: 'did_resolution',
                        requestDid: entryPoint.did,
                    }),
                    error,
                );
                expect(error.message).toContain('public jwk not found for kid');
            }
        }
    });

    test('request kid that is not in a valid did document returns request invalid', async () => {
        for (const entryPoint of entryPoints) {
            const error = await getEntryPointError(entryPoint, undefined, {
                didDocumentPayload:
                    didDocumentWithRequestVerificationKeyRemoved(entryPoint),
            });

            assertDiagnostics(
                expectedDiagnostics(entryPoint, {
                    errorCode: entryPoint.requestInvalidCode,
                    sourceErrorCode: VCLErrorCode.SdkError,
                    validationPhase: 'request_validation',
                    requestDid: entryPoint.did,
                }),
                error,
            );
            expect(error.message).toContain('public jwk not found for kid');
        }
    });

    test('credential manifest jwt without kid returns request invalid', async () => {
        const entryPoint = issuingEntryPoint();
        const error = await getCredentialManifestDescriptorError(
            credentialManifestDescriptorByService(),
            {
                requestPayload: {
                    issuing_request: jwtWithoutKid(
                        CredentialManifestMocks.JwtCredentialManifest1,
                    ),
                },
            },
        );

        assertDiagnostics(
            expectedDiagnostics(entryPoint, {
                errorCode: VCLErrorCode.IssuerRequestInvalid,
                sourceErrorCode: VCLErrorCode.SdkError,
                validationPhase: 'request_validation',
                requestDid: entryPoint.did,
            }),
            error,
        );
        expect(error.message).toContain('Empty credentialManifest.jwt.kid');
    });

    test('credential manifest use case rejects an empty repository jwt', async () => {
        await expect(
            credentialManifestUseCase({
                repositoryJwt: '',
            }).getCredentialManifest(
                credentialManifestDescriptor(
                    DeepLinkMocks.CredentialManifestDeepLinkDevNet,
                ),
                {},
            ),
        ).rejects.toMatchObject({
            message: 'Empty jwtStr',
        });
    });

    test('credential manifest use case classifies verifier false as request invalid', async () => {
        const entryPoint = issuingEntryPoint();

        try {
            await credentialManifestUseCase({
                verifierResult: false,
            }).getCredentialManifest(
                credentialManifestDescriptor(
                    DeepLinkMocks.CredentialManifestDeepLinkDevNet,
                ),
                {},
            );
        } catch (error) {
            expect(error).toBeInstanceOf(VCLError);
            const sdkError = error as VCLError;
            assertDiagnostics(
                expectedDiagnostics(entryPoint, {
                    errorCode: VCLErrorCode.IssuerRequestInvalid,
                    sourceErrorCode: VCLErrorCode.SdkError,
                    validationPhase: 'request_validation',
                    requestDid: entryPoint.did,
                }),
                sdkError,
            );
            expect(sdkError.message).toContain(
                'Failed to verify credentialManifest jwt',
            );
            return;
        }

        throw new Error('Expected credential manifest use case to reject');
    });

    test('credential manifest by service succeeds without deep link verification', async () => {
        const credentialManifest = await getCredentialManifestByService(
            credentialManifestDescriptorByService(),
        );

        expect(credentialManifest.deepLink).toBeNull();
        expect(credentialManifest.did).toEqual(DeepLinkMocks.IssuerDid);
    });

    test('verified profile lookup failure propagates network error details', async () => {
        for (const entryPoint of entryPoints) {
            const payload =
                '{"message":"profile missing","errorCode":"sdk_error"}';
            const error = await getEntryPointError(entryPoint, undefined, {
                verifiedProfileStatusCode: 404,
                verifiedProfilePayload: payload,
                verifiedProfileContentType: jsonContentType,
            });

            assertDiagnostics(
                expectedDiagnostics(entryPoint, {
                    payload,
                    errorCode: entryPoint.notRegisteredCode,
                    sourceErrorCode: VCLErrorCode.SdkError,
                    statusCode: 404,
                    validationPhase: 'registration_check',
                    requestDid: entryPoint.did,
                }),
                error,
            );
            expect(error.message).toEqual('profile missing');
        }
    });

    test('empty verified profile fails service type verification', async () => {
        for (const entryPoint of entryPoints) {
            const error = await getEntryPointError(entryPoint, undefined, {
                verifiedProfilePayload: {},
            });

            assertDiagnostics(
                expectedDiagnostics(entryPoint, {
                    errorCode: entryPoint.requestUnauthorizedCode,
                    sourceErrorCode:
                        ProfileServiceTypeVerifier.SourceWrongServiceType,
                    statusCode: VCLStatusCode.VerificationError,
                    validationPhase: 'request_authorization',
                    requestDid: entryPoint.did,
                }),
                error,
            );
            expect(error.message).toContain('Wrong service type');
        }
    });

    test('wrong issuer or verifier service type returns sdk_error with verification status', async () => {
        for (const entryPoint of entryPoints) {
            const wrongServiceProfile =
                entryPoint.type === 'issuing'
                    ? VerifiedProfileMocks.readonlyVerifiedProfileInspectorJsonStr
                    : VerifiedProfileMocks.VerifiedProfileIssuerJsonStr1;
            const error = await getEntryPointError(entryPoint, undefined, {
                verifiedProfilePayload: JSON.parse(wrongServiceProfile),
            });

            assertDiagnostics(
                expectedDiagnostics(entryPoint, {
                    errorCode: entryPoint.requestUnauthorizedCode,
                    sourceErrorCode:
                        ProfileServiceTypeVerifier.SourceWrongServiceType,
                    statusCode: VCLStatusCode.VerificationError,
                    validationPhase: 'request_authorization',
                    requestDid: entryPoint.did,
                }),
                error,
            );
            expect(error.message).toContain('Wrong service type');
        }
    });

    test('duplicate query params use last did value at sdk entry point', async () => {
        for (const entryPoint of entryPoints) {
            const capturedRequest = { urls: [] };
            const deepLink = new VCLDeepLink(
                `velocity-network://${entryPoint.schemePath}?request_uri=${entryPoint.encodedRequestUri}` +
                    `&${entryPoint.didParam}=did:example:first&${entryPoint.didParam}=${entryPoint.lastDid}`,
            );
            const error = await getEntryPointError(
                entryPoint,
                deepLink,
                {},
                capturedRequest,
            );

            assertDiagnostics(
                expectedDiagnostics(entryPoint, {
                    errorCode: entryPoint.requestInvalidCode,
                    sourceErrorCode: entryPoint.legacyMismatchErrorCode,
                    validationPhase: 'request_validation',
                    requestDid: entryPoint.did,
                }),
                error,
            );
            expect(
                capturedRequest.urls.some((url) =>
                    url.includes(entryPoint.lastDid),
                ),
            ).toBe(true);
        }
    });

    test('request validation failures use taxonomy codes', async () => {
        for (const entryPoint of entryPoints) {
            const deepLink = new VCLDeepLink(
                `velocity-network://${entryPoint.schemePath}?request_uri=${entryPoint.encodedRequestUri}` +
                    `&${entryPoint.didParam}=did:example:wrong`,
            );
            const error = await getEntryPointError(entryPoint, deepLink);

            assertDiagnostics(
                expectedDiagnostics(entryPoint, {
                    errorCode: entryPoint.requestInvalidCode,
                    sourceErrorCode: entryPoint.legacyMismatchErrorCode,
                    validationPhase: 'request_validation',
                    requestDid: entryPoint.did,
                }),
                error,
            );
        }
    });

    test('jwt verification failure propagates sdk_error from injected jwt service', async () => {
        const expectedError = new VCLError({
            errorCode: VCLErrorCode.SdkError,
            message: 'jwt signature verification failed',
        });

        for (const entryPoint of entryPoints) {
            const error = await getEntryPointError(
                entryPoint,
                undefined,
                {},
                undefined,
                expectedError,
            );

            assertDiagnostics(
                expectedDiagnostics(entryPoint, {
                    errorCode: entryPoint.requestInvalidCode,
                    sourceErrorCode: VCLErrorCode.SdkError,
                    validationPhase: 'request_validation',
                    requestDid: entryPoint.did,
                }),
                error,
            );
            expect(error.message).toEqual('jwt signature verification failed');
        }
    });
});

const entryPoints: EntryPoint[] = [
    {
        defaultDeepLink: DeepLinkMocks.CredentialManifestDeepLinkDevNet,
        did: DeepLinkMocks.IssuerDid,
        didParam: 'issuerDid',
        didUnresolvableCode: VCLErrorCode.IssuerDidUnresolvable,
        encodedRequestUri: DeepLinkMocks.CredentialManifestRequestUriStr,
        lastDid: 'did:example:last',
        legacyMismatchErrorCode: VCLErrorCode.MismatchedRequestIssuerDid,
        notRegisteredCode: VCLErrorCode.IssuerNotRegistered,
        otherDidParam: 'inspectorDid',
        requestInvalidCode: VCLErrorCode.IssuerRequestInvalid,
        requestKind: 'issuing_request',
        requestUnauthorizedCode: VCLErrorCode.IssuerRequestUnauthorized,
        schemePath: 'issue',
        type: 'issuing',
    },
    {
        defaultDeepLink: DeepLinkMocks.PresentationRequestDeepLinkDevNet,
        did: DeepLinkMocks.InspectorDid,
        didParam: 'inspectorDid',
        didUnresolvableCode: VCLErrorCode.VerifierDidUnresolvable,
        encodedRequestUri: DeepLinkMocks.PresentationRequestRequestUriStr,
        lastDid: 'did:example:last',
        legacyMismatchErrorCode:
            VCLErrorCode.MismatchedPresentationRequestInspectorDid,
        notRegisteredCode: VCLErrorCode.VerifierNotRegistered,
        otherDidParam: 'issuerDid',
        requestInvalidCode: VCLErrorCode.VerifierRequestInvalid,
        requestKind: 'presentation_request',
        requestUnauthorizedCode: VCLErrorCode.VerifierRequestUnauthorized,
        schemePath: 'inspect',
        type: 'presentation',
    },
];

const getEntryPointError = async (
    entryPoint: EntryPoint,
    deepLink = entryPoint.defaultDeepLink,
    router: BaselineRouter = {},
    capturedRequest?: CapturedRequest,
    jwtVerificationError?: VCLError,
): Promise<VCLError> => {
    const vcl = initializedVcl(jwtVerificationError);
    setupRouter(entryPoint, deepLink, router, capturedRequest);

    try {
        if (entryPoint.type === 'issuing') {
            await vcl.getCredentialManifest(
                credentialManifestDescriptor(deepLink),
            );
        } else {
            await vcl.getPresentationRequest(presentationDescriptor(deepLink));
        }
    } catch (error) {
        expect(error).toBeInstanceOf(VCLError);
        return error as VCLError;
    }

    throw new Error('Expected SDK entry point to reject with VCLError');
};

const initializedVcl = (jwtVerificationError?: VCLError): VCLImpl => {
    const vcl = new VCLImpl();
    const jwtServiceRepository = new JwtServiceRepositoryImpl(
        new JwtSignServiceMock(''),
        new FixedJwtVerifyService(jwtVerificationError),
    );
    vcl.initializationDescriptor = new VCLInitializationDescriptor(
        VCLEnvironment.Prod,
        VCLXVnfProtocolVersion.XVnfProtocolVersion1,
        new VCLCryptoServicesDescriptor(
            new KeyServiceMock(),
            new JwtSignServiceMock(''),
            new FixedJwtVerifyService(jwtVerificationError),
        ),
    );

    vcl.profileServiceTypeVerifier = new ProfileServiceTypeVerifier(
        new VerifiedProfileUseCaseImpl(
            new VerifiedProfileRepositoryImpl(new NetworkServiceImpl()),
        ),
    );
    vcl.credentialManifestUseCase = new CredentialManifestUseCaseImpl(
        new CredentialManifestRepositoryImpl(new NetworkServiceImpl()),
        new ResolveDidDocumentRepositoryImpl(new NetworkServiceImpl()),
        jwtServiceRepository,
        new CredentialManifestByDeepLinkVerifierImpl(),
    );
    vcl.presentationRequestUseCase = new PresentationRequestUseCaseImpl(
        new PresentationRequestRepositoryImpl(new NetworkServiceImpl()),
        new ResolveDidDocumentRepositoryImpl(new NetworkServiceImpl()),
        jwtServiceRepository,
        new PresentationRequestByDeepLinkVerifierImpl(),
    );

    return vcl;
};

const credentialManifestDescriptor = (deepLink: VCLDeepLink) =>
    new VCLCredentialManifestDescriptorByDeepLink(
        deepLink,
        VCLIssuingType.Career,
        null,
        DidJwkMocks.DidJwk,
    );

const presentationDescriptor = (deepLink: VCLDeepLink) =>
    new VCLPresentationRequestDescriptor(deepLink, null, DidJwkMocks.DidJwk);

const credentialManifestDescriptorByService = ({
    endpoint = DeepLinkMocks.CredentialManifestRequestDecodedUriStr,
    did = DeepLinkMocks.IssuerDid,
}: {
    endpoint?: string;
    did?: string;
} = {}) =>
    new VCLCredentialManifestDescriptorByService(
        new VCLService({
            id: `${DeepLinkMocks.IssuerDid}#credential-agent-issuer-1`,
            type: 'VelocityCredentialAgentIssuer_v1.0',
            serviceEndpoint: endpoint,
            credentialTypes: ['PastEmploymentPosition'],
        }),
        VCLIssuingType.Career,
        null,
        null,
        DidJwkMocks.DidJwk,
        did,
    );

const getCredentialManifestDescriptorError = async (
    descriptor: VCLCredentialManifestDescriptor,
    router: BaselineRouter = {},
    jwtVerificationError?: VCLError,
    setupNetwork = true,
): Promise<VCLError> => {
    try {
        await getCredentialManifestByService(
            descriptor,
            router,
            jwtVerificationError,
            setupNetwork,
        );
    } catch (error) {
        expect(error).toBeInstanceOf(VCLError);
        return error as VCLError;
    }

    throw new Error('Expected getCredentialManifest to reject with VCLError');
};

const getCredentialManifestByService = async (
    descriptor: VCLCredentialManifestDescriptor,
    router: BaselineRouter = {},
    jwtVerificationError?: VCLError,
    setupNetwork = true,
): Promise<VCLCredentialManifest> => {
    const vcl = initializedVcl(jwtVerificationError);
    if (setupNetwork) {
        setupCredentialManifestDescriptorRouter(descriptor, router);
    }
    return vcl.getCredentialManifest(descriptor);
};

const credentialManifestUseCase = ({
    repositoryJwt = CredentialManifestMocks.JwtCredentialManifest1,
    verifierResult = true,
}: {
    repositoryJwt?: string;
    verifierResult?: boolean;
} = {}) =>
    new CredentialManifestUseCaseImpl(
        {
            getCredentialManifest: async () => repositoryJwt,
        },
        {
            resolveDidDocument: async () => DidDocumentMocks.DidDocumentMock,
        },
        {
            verifyJwt: async () => true,
        },
        {
            verifyCredentialManifest: async () => verifierResult,
        },
    );

const setupRouter = (
    entryPoint: EntryPoint,
    deepLink: VCLDeepLink,
    router: BaselineRouter,
    capturedRequest?: CapturedRequest,
) => {
    mockVerifiedProfile(entryPoint, deepLink, router);

    const endpoint =
        entryPoint.type === 'issuing'
            ? credentialManifestDescriptor(deepLink).endpoint
            : presentationDescriptor(deepLink).endpoint;

    if (endpoint && isHttpUrl(endpoint)) {
        mockSdkRequestEndpoint(entryPoint, endpoint, router, capturedRequest);
    }

    mockDidDocument(entryPoint, router);
};

const setupCredentialManifestDescriptorRouter = (
    descriptor: VCLCredentialManifestDescriptor,
    router: BaselineRouter,
) => {
    const entryPoint = issuingEntryPoint();
    mockVerifiedProfileForDid(
        entryPoint,
        descriptor.did ?? entryPoint.did,
        router,
    );

    const { endpoint } = descriptor;
    if (endpoint && isHttpUrl(endpoint)) {
        mockSdkRequestEndpoint(entryPoint, endpoint, router);
    }

    mockDidDocument(entryPoint, router);
};

const mockVerifiedProfile = (
    entryPoint: EntryPoint,
    deepLink: VCLDeepLink,
    router: BaselineRouter,
) => {
    mockVerifiedProfileForDid(
        entryPoint,
        safeDid(deepLink) ?? entryPoint.did,
        router,
    );
};

const mockVerifiedProfileForDid = (
    entryPoint: EntryPoint,
    did: string,
    {
        verifiedProfileContentType = jsonContentType,
        verifiedProfilePayload = defaultVerifiedProfilePayload(entryPoint),
        verifiedProfileStatusCode = 200,
    }: BaselineRouter,
) => {
    const path = `/api/v0.6/organizations/${did}/verified-profile`;

    nock(registrarOrigin)
        .get((uri) => uri === path || decodeURIComponent(uri) === path)
        .reply(
            verifiedProfileStatusCode,
            normalizePayload(verifiedProfilePayload),
            {
                'content-type': verifiedProfileContentType,
            },
        );
};

const mockSdkRequestEndpoint = (
    entryPoint: EntryPoint,
    endpoint: string,
    {
        requestContentType = jsonContentType,
        requestFailure,
        requestPayload = defaultRequestPayload(entryPoint),
        requestStatusCode = 200,
    }: BaselineRouter,
    capturedRequest?: CapturedRequest,
) => {
    const { origin } = new URL(endpoint);
    const interceptor = nock(origin).get((uri) => {
        capturedRequest?.urls.push(decodeURIComponent(uri));
        return true;
    });

    if (requestFailure) {
        interceptor.replyWithError(requestFailure.message);
        return;
    }

    interceptor.reply(
        requestStatusCode,
        () => {
            return normalizePayload(requestPayload);
        },
        { 'content-type': requestContentType },
    );
};

const mockDidDocument = (
    entryPoint: EntryPoint,
    {
        didDocumentContentType = jsonContentType,
        didDocumentPayload = DidDocumentMocks.DidDocumentMock.payload,
        didDocumentStatusCode = 200,
    }: BaselineRouter,
) => {
    const did =
        entryPoint.type === 'issuing'
            ? DeepLinkMocks.IssuerDid
            : PresentationRequestMocks.PresentationRequest.iss;

    mockRegistrarGet(
        `/api/v0.6/resolve-did/${did}`,
        normalizePayload(didDocumentPayload),
        didDocumentStatusCode,
        {},
        { 'content-type': didDocumentContentType },
    );
};

const defaultVerifiedProfilePayload = (entryPoint: EntryPoint) =>
    entryPoint.type === 'issuing'
        ? JSON.parse(VerifiedProfileMocks.VerifiedProfileIssuerJsonStr1)
        : JSON.parse(
              VerifiedProfileMocks.readonlyVerifiedProfileInspectorJsonStr,
          );

const defaultRequestPayload = (entryPoint: EntryPoint) =>
    entryPoint.type === 'issuing'
        ? JSON.parse(CredentialManifestMocks.CredentialManifest1)
        : JSON.parse(
              PresentationRequestMocks.EncodedPresentationRequestResponse,
          );

const didDocumentWithRequestVerificationKeyRemoved = (
    entryPoint: EntryPoint,
) => {
    const payload = JSON.parse(
        JSON.stringify(DidDocumentMocks.DidDocumentMock.payload),
    );
    const requestKeyId =
        entryPoint.type === 'issuing' ? '#exchange-key-1' : '#key-1';

    return {
        ...payload,
        verificationMethod: payload.verificationMethod.filter(
            (method: { id?: string }) => method.id !== requestKeyId,
        ),
    };
};

const assertDiagnostics = (expected: ErrorDiagnostics, actual: VCLError) => {
    expect(toDiagnostics(actual)).toEqual(canonicalizeDiagnostics(expected));
};

const toDiagnostics = (error: VCLError): ErrorDiagnostics => ({
    payload: canonicalJsonOrSelf(error.payload),
    error: error.error,
    errorCode: error.errorCode,
    sourceErrorCode: error.sourceErrorCode,
    requestId: error.requestId,
    statusCode: error.statusCode,
    validationPhase: error.validationPhase,
    requestDid: error.requestDid,
    requestUri: error.requestUri,
    requestKind: error.requestKind,
});

const expectedDiagnostics = (
    entryPoint: EntryPoint,
    diagnostics: ErrorDiagnostics,
): ErrorDiagnostics => ({
    payload: null,
    error: null,
    sourceErrorCode: null,
    requestId: null,
    statusCode: null,
    validationPhase: null,
    requestDid: null,
    requestUri: null,
    requestKind: entryPoint.requestKind,
    ...diagnostics,
});

const canonicalizeDiagnostics = (
    diagnostics: ErrorDiagnostics,
): ErrorDiagnostics => ({
    ...diagnostics,
    payload: canonicalJsonOrSelf(diagnostics.payload),
});

const canonicalJsonOrSelf = (value: string | null | undefined) => {
    if (value == null) {
        return value;
    }
    try {
        return JSON.stringify(JSON.parse(value));
    } catch {
        return value;
    }
};

const simpleRequestUri = () =>
    encodeURIComponent('https://example.com/request');

const issuingEntryPoint = () =>
    entryPoints.find((entryPoint) => entryPoint.type === 'issuing')!;

const jwtWithoutKid = (jwt: string) => {
    const [, payload, signature] = jwt.split('.');
    return `${base64UrlJson({
        typ: 'JWT',
        alg: 'ES256K',
    })}.${payload}.${signature}`;
};

const base64UrlJson = (value: unknown) =>
    Buffer.from(JSON.stringify(value)).toString('base64url');

const normalizePayload = (payload: unknown) => {
    if (typeof payload === 'string' && isJsonString(payload)) {
        return JSON.parse(payload);
    }
    return payload;
};

const isJsonString = (value: string): boolean => {
    try {
        JSON.parse(value);
        return true;
    } catch {
        return false;
    }
};

const isHttpUrl = (value: string): boolean => {
    try {
        const { protocol } = new URL(value);
        return protocol === 'http:' || protocol === 'https:';
    } catch {
        return false;
    }
};

const safeDid = (deepLink: VCLDeepLink) => {
    try {
        return deepLink.did;
    } catch {
        return null;
    }
};

class FixedJwtVerifyService implements VCLJwtVerifyService {
    constructor(private readonly verificationError?: VCLError) {}

    async verify(
        _jwt: VCLJwt,
        _publicJwk: VCLPublicJwk | null,
        _remoteCryptoServicesToken: VCLToken | null,
    ): Promise<boolean> {
        if (this.verificationError) {
            throw this.verificationError;
        }
        return true;
    }
}
