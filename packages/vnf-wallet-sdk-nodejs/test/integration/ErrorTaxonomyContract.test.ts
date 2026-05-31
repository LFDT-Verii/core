/* eslint-disable no-await-in-loop */
import { beforeEach, describe, test } from 'node:test';
import { expect } from 'expect';
import { VCLError, VCLErrorCode, VCLDeepLink, VCLStatusCode } from '../../src';
import VelocityDeepLinkValidator from '../../src/impl/utils/VelocityDeepLinkValidator';
import { SourceMalformedVerifiedProfile } from '../../src/impl/utils/ErrorTaxonomy';
import { ProfileServiceTypeVerifier } from '../../src/impl/utils/ProfileServiceTypeVerifier';
import { CredentialManifestMocks } from '../infrastructure/resources/valid/CredentialManifestMocks';
import { DeepLinkMocks } from '../infrastructure/resources/valid/DeepLinkMocks';
import { DidDocumentMocks } from '../infrastructure/resources/valid/DidDocumentMocks';
import { ErrorMocks } from '../infrastructure/resources/valid/ErrorMocks';
import { PresentationRequestMocks } from '../infrastructure/resources/valid/PresentationRequestMocks';
import { VerifiedProfileMocks } from '../infrastructure/resources/valid/VerifiedProfileMocks';
import { useNockLifecycle } from '../utils/nock';
import {
    didDocumentWithRequestVerificationKeyRemoved,
    entryPoints,
    callEntryPoint,
    issuingEntryPoint,
    jsonContentType,
    resetGlobalConfig,
} from './errorTaxonomyTestHarness';
import type { EntryPoint } from './errorTaxonomyTestHarness';

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

type ErrorDiagnosticOverrides = Omit<
    ErrorDiagnostics,
    'requestKind' | 'validationPhase'
>;

type TaxonomyErrorExpectation = ErrorDiagnosticOverrides & {
    message?: string;
    messageContaining?: string;
};

type ValidationPhase =
    | 'client_request_fetch'
    | 'did_resolution'
    | 'link_validation'
    | 'registration_check'
    | 'request_authorization'
    | 'request_validation';

describe('Error taxonomy contract', () => {
    useNockLifecycle();

    beforeEach(() => {
        resetGlobalConfig();
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
                const { error } = await callEntryPoint(entryPoint, {
                    deepLink,
                });

                assertTaxonomyError(entryPoint, error, 'link_validation', {
                    errorCode: VCLErrorCode.InvalidLink,
                    sourceErrorCode,
                    requestUri: deepLink.requestUri,
                });
            }
        }
    });

    test('opaque velocity uris return unparseable invalid link', async () => {
        for (const entryPoint of entryPoints) {
            const deepLink = new VCLDeepLink(
                `velocity-network:${entryPoint.schemePath}?request_uri=${entryPoint.encodedRequestUri}&${entryPoint.didParam}=did:example:entity`,
            );
            const { error } = await callEntryPoint(entryPoint, {
                deepLink,
            });

            assertTaxonomyError(entryPoint, error, 'link_validation', {
                errorCode: VCLErrorCode.InvalidLink,
                sourceErrorCode:
                    VelocityDeepLinkValidator.SourceUnparseablePayload,
                requestUri: deepLink.requestUri,
            });
        }
    });

    test('unsupported scheme with known query params returns null endpoint sdk_error', async () => {
        for (const entryPoint of entryPoints) {
            const deepLink = new VCLDeepLink(
                `https://example.com/${entryPoint.schemePath}?${entryPoint.didParam}=did:example:entity`,
            );
            const { error } = await callEntryPoint(entryPoint, {
                deepLink,
            });

            assertTaxonomyError(entryPoint, error, 'link_validation', {
                errorCode: VCLErrorCode.InvalidLink,
                sourceErrorCode:
                    VelocityDeepLinkValidator.SourceUnsupportedVelocityLink,
                requestUri: deepLink.requestUri,
            });
        }
    });

    test('unsupported flow path returns invalid link', async () => {
        for (const entryPoint of entryPoints) {
            const deepLink = new VCLDeepLink(
                `velocity-network://unknown-flow?request_uri=${entryPoint.encodedRequestUri}&${entryPoint.didParam}=did:example:entity`,
            );
            const { error } = await callEntryPoint(entryPoint, {
                deepLink,
            });

            assertTaxonomyError(entryPoint, error, 'link_validation', {
                errorCode: VCLErrorCode.InvalidLink,
                sourceErrorCode:
                    VelocityDeepLinkValidator.SourceUnsupportedVelocityLink,
                requestUri: deepLink.requestUri,
            });
        }
    });

    test('wrong flow did param is accepted by lax did parsing and fails request verification', async () => {
        for (const entryPoint of entryPoints) {
            const deepLink = new VCLDeepLink(
                `velocity-network://${entryPoint.schemePath}` +
                    `?request_uri=${encodeURIComponent('https://example.com/request')}` +
                    `&${entryPoint.otherDidParam}=did:example:entity`,
            );
            const { error } = await callEntryPoint(entryPoint, {
                deepLink,
            });

            assertTaxonomyError(entryPoint, error, 'request_validation', {
                errorCode: entryPoint.requestInvalidCode,
                sourceErrorCode: entryPoint.legacyMismatchErrorCode,
                requestDid: entryPoint.did,
            });
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
            const { error } = await callEntryPoint(entryPoint, {
                deepLink,
            });

            assertTaxonomyError(entryPoint, error, 'link_validation', {
                errorCode: VCLErrorCode.InvalidLink,
                sourceErrorCode:
                    VelocityDeepLinkValidator.SourceInvalidOrMissingRequestUri,
                requestUri: null,
            });
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
                const { error } = await callEntryPoint(entryPoint, {
                    deepLink,
                });

                assertTaxonomyError(entryPoint, error, 'link_validation', {
                    errorCode: VCLErrorCode.InvalidLink,
                    sourceErrorCode:
                        VelocityDeepLinkValidator.SourceInvalidOrMissingRequestUri,
                    requestUri: deepLink.requestUri,
                });
            }
        }
    });

    test('credential manifest by service validates endpoint and did without a deep link', async () => {
        const entryPoint = issuingEntryPoint();
        for (const testCase of [
            {
                endpoint: 'ftp://example.com/request',
                requestUri: 'ftp://example.com/request',
                sourceErrorCode:
                    VelocityDeepLinkValidator.SourceInvalidOrMissingRequestEndpoint,
            },
            {
                endpoint: null,
                requestUri: null,
                sourceErrorCode:
                    VelocityDeepLinkValidator.SourceInvalidOrMissingRequestEndpoint,
            },
            {
                did: '',
                requestUri: null,
                sourceErrorCode: null,
                messageContaining: 'did was not found',
            },
        ]) {
            const { error } = await callEntryPoint(entryPoint, testCase);

            assertTaxonomyError(entryPoint, error, 'link_validation', {
                errorCode: VCLErrorCode.InvalidLink,
                sourceErrorCode: testCase.sourceErrorCode,
                requestUri: testCase.requestUri,
                messageContaining: testCase.messageContaining,
            });
        }
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
                const { error } = await callEntryPoint(entryPoint, {
                    deepLink,
                });

                assertTaxonomyError(entryPoint, error, 'link_validation', {
                    errorCode: VCLErrorCode.InvalidLink,
                    sourceErrorCode:
                        VelocityDeepLinkValidator.SourceInvalidOrMissingDid,
                    requestUri: deepLink.requestUri,
                });
            }
        }
    });

    test('transport failure returns sdk_error with network status only', async () => {
        for (const entryPoint of entryPoints) {
            const { error } = await callEntryPoint(entryPoint, {
                router: {
                    requestFailure: new Error('offline'),
                },
            });

            assertTaxonomyError(entryPoint, error, 'client_request_fetch', {
                errorCode: VCLErrorCode.ConnectivityFailure,
                statusCode: VCLStatusCode.NetworkError,
                requestUri: entryPoint.defaultDeepLink.requestUri,
                messageContaining: 'offline',
            });
        }
    });

    test('request endpoint 401 and 403 preserve http status and payload error code', async () => {
        for (const entryPoint of entryPoints) {
            for (const statusCode of [401, 403]) {
                const { error } = await callEntryPoint(entryPoint, {
                    router: {
                        requestStatusCode: statusCode,
                        requestPayload: ErrorMocks.Payload,
                        requestContentType: jsonContentType,
                    },
                });

                assertTaxonomyError(entryPoint, error, 'client_request_fetch', {
                    payload: ErrorMocks.Payload,
                    error: ErrorMocks.Error,
                    errorCode: VCLErrorCode.ClientRequestUnauthorized,
                    sourceErrorCode: ErrorMocks.ErrorCode,
                    requestId: ErrorMocks.RequestId,
                    statusCode,
                    requestUri: entryPoint.defaultDeepLink.requestUri,
                    message: ErrorMocks.Message,
                });
            }
        }
    });

    test('request endpoint rejections preserve http status when payload has no statusCode', async () => {
        const { statusCode: _statusCode, ...payloadWithoutStatusCode } =
            JSON.parse(ErrorMocks.Payload);
        const payload = JSON.stringify(payloadWithoutStatusCode);

        for (const entryPoint of entryPoints) {
            for (const statusCode of [400, 404, 409, 410, 422, 500, 502]) {
                const { error } = await callEntryPoint(entryPoint, {
                    router: {
                        requestStatusCode: statusCode,
                        requestPayload: payload,
                        requestContentType: jsonContentType,
                    },
                });

                assertTaxonomyError(entryPoint, error, 'client_request_fetch', {
                    payload,
                    error: ErrorMocks.Error,
                    errorCode: VCLErrorCode.ClientRequestRejected,
                    sourceErrorCode: ErrorMocks.ErrorCode,
                    requestId: ErrorMocks.RequestId,
                    statusCode,
                    requestUri: entryPoint.defaultDeepLink.requestUri,
                });
            }
        }
    });

    test('plain text request endpoint rejections default to sdk_error with http status and payload message', async () => {
        for (const entryPoint of entryPoints) {
            const { error } = await callEntryPoint(entryPoint, {
                router: {
                    requestStatusCode: 500,
                    requestPayload: 'plain text failure',
                    requestContentType: 'text/plain',
                },
            });

            assertTaxonomyError(entryPoint, error, 'client_request_fetch', {
                payload: 'plain text failure',
                errorCode: VCLErrorCode.ClientRequestRejected,
                sourceErrorCode: VCLErrorCode.SdkError,
                statusCode: 500,
                requestUri: entryPoint.defaultDeepLink.requestUri,
                message: 'plain text failure',
            });
            expect(error.payload).toEqual('plain text failure');
        }
    });

    test('json request endpoint rejections without errorCode default to sdk_error', async () => {
        const { errorCode: _errorCode, ...payloadWithoutErrorCode } =
            JSON.parse(ErrorMocks.Payload);
        const payload = JSON.stringify(payloadWithoutErrorCode);

        for (const entryPoint of entryPoints) {
            const { error } = await callEntryPoint(entryPoint, {
                router: {
                    requestStatusCode: 422,
                    requestPayload: payload,
                    requestContentType: jsonContentType,
                },
            });

            assertTaxonomyError(entryPoint, error, 'client_request_fetch', {
                payload,
                error: ErrorMocks.Error,
                errorCode: VCLErrorCode.ClientRequestRejected,
                sourceErrorCode: VCLErrorCode.SdkError,
                requestId: ErrorMocks.RequestId,
                statusCode: 422,
                requestUri: entryPoint.defaultDeepLink.requestUri,
                message: ErrorMocks.Message,
            });
        }
    });

    test('empty request endpoint response returns request invalid', async () => {
        for (const entryPoint of entryPoints) {
            const { error } = await callEntryPoint(entryPoint, {
                router: {
                    requestPayload: '',
                },
            });

            assertTaxonomyError(entryPoint, error, 'request_validation', {
                errorCode: entryPoint.requestInvalidCode,
                sourceErrorCode: VCLErrorCode.SdkError,
                requestDid: entryPoint.did,
            });
        }
    });

    test('malformed request endpoint response returns request invalid', async () => {
        for (const entryPoint of entryPoints) {
            const { error } = await callEntryPoint(entryPoint, {
                router: {
                    requestPayload: 'not json',
                },
            });

            assertTaxonomyError(entryPoint, error, 'request_validation', {
                errorCode: entryPoint.requestInvalidCode,
                sourceErrorCode: VCLErrorCode.SdkError,
                requestDid: entryPoint.did,
            });
        }
    });

    test('missing expected request fields return request invalid', async () => {
        for (const entryPoint of entryPoints) {
            const { error } = await callEntryPoint(entryPoint, {
                router: {
                    requestPayload: {},
                },
            });

            assertTaxonomyError(entryPoint, error, 'request_validation', {
                errorCode: entryPoint.requestInvalidCode,
                sourceErrorCode: VCLErrorCode.SdkError,
                requestDid: entryPoint.did,
            });
        }
    });

    test('empty request jwt field returns request invalid', async () => {
        for (const entryPoint of entryPoints) {
            const requestKey =
                entryPoint.type === 'issuing'
                    ? 'issuing_request'
                    : 'presentation_request';
            const { error } = await callEntryPoint(entryPoint, {
                router: {
                    requestPayload: {
                        [requestKey]: '',
                    },
                },
            });

            assertTaxonomyError(entryPoint, error, 'request_validation', {
                errorCode: entryPoint.requestInvalidCode,
                sourceErrorCode: VCLErrorCode.SdkError,
                requestDid: entryPoint.did,
                message: `Missing ${requestKey}`,
            });
        }
    });

    test('malformed request jwt returns request invalid from sdk entry point', async () => {
        for (const entryPoint of entryPoints) {
            const requestKey =
                entryPoint.type === 'issuing'
                    ? 'issuing_request'
                    : 'presentation_request';
            const { error } = await callEntryPoint(entryPoint, {
                router: {
                    requestPayload: {
                        [requestKey]: 'not-a-jwt',
                    },
                },
            });

            assertTaxonomyError(entryPoint, error, 'request_validation', {
                error: '{}',
                errorCode: entryPoint.requestInvalidCode,
                sourceErrorCode: VCLErrorCode.SdkError,
                requestDid: entryPoint.did,
                messageContaining: 'Unexpected token',
            });
        }
    });

    test('request jwt without iss returns request invalid from sdk entry point', async () => {
        for (const entryPoint of entryPoints) {
            const requestKey =
                entryPoint.type === 'issuing'
                    ? 'issuing_request'
                    : 'presentation_request';
            const requestJwt =
                entryPoint.type === 'issuing'
                    ? CredentialManifestMocks.JwtCredentialManifest1
                    : PresentationRequestMocks.EncodedPresentationRequest;
            const { error } = await callEntryPoint(entryPoint, {
                router: {
                    requestPayload: {
                        [requestKey]: jwtWithoutPayloadClaim(requestJwt, 'iss'),
                    },
                },
            });

            assertTaxonomyError(entryPoint, error, 'request_validation', {
                errorCode: entryPoint.requestInvalidCode,
                sourceErrorCode: VCLErrorCode.SdkError,
                requestDid: entryPoint.did,
                message: `Missing ${requestKey}`,
            });
        }
    });

    test('did resolution network failure propagates sdk_error and status from network', async () => {
        for (const entryPoint of entryPoints) {
            const payload =
                '{"message":"resolve failed","errorCode":"sdk_error"}';
            const { error } = await callEntryPoint(entryPoint, {
                router: {
                    didDocumentStatusCode: 404,
                    didDocumentPayload: payload,
                    didDocumentContentType: jsonContentType,
                },
            });

            assertTaxonomyError(entryPoint, error, 'did_resolution', {
                payload,
                errorCode: entryPoint.didUnresolvableCode,
                sourceErrorCode: VCLErrorCode.SdkError,
                statusCode: 404,
                requestDid: entryPoint.did,
                message: 'resolve failed',
            });
        }
    });

    test('invalid did document shape returns did unresolvable at did resolution', async () => {
        for (const entryPoint of entryPoints) {
            const { error } = await callEntryPoint(entryPoint, {
                router: {
                    didDocumentPayload: 'not json',
                },
            });

            assertTaxonomyError(entryPoint, error, 'did_resolution', {
                errorCode: entryPoint.didUnresolvableCode,
                sourceErrorCode: VCLErrorCode.SdkError,
                requestDid: entryPoint.did,
                messageContaining: 'public jwk not found for kid',
            });
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
                const { error } = await callEntryPoint(entryPoint, {
                    router: {
                        didDocumentPayload,
                    },
                });

                assertTaxonomyError(entryPoint, error, 'did_resolution', {
                    errorCode: entryPoint.didUnresolvableCode,
                    sourceErrorCode: VCLErrorCode.SdkError,
                    requestDid: entryPoint.did,
                    messageContaining: 'public jwk not found for kid',
                });
            }
        }
    });

    test('request kid that is not in a valid did document returns request invalid', async () => {
        for (const entryPoint of entryPoints) {
            const { error } = await callEntryPoint(entryPoint, {
                router: {
                    didDocumentPayload:
                        didDocumentWithRequestVerificationKeyRemoved(
                            entryPoint,
                        ),
                },
            });

            assertTaxonomyError(entryPoint, error, 'request_validation', {
                errorCode: entryPoint.requestInvalidCode,
                sourceErrorCode: VCLErrorCode.SdkError,
                requestDid: entryPoint.did,
                messageContaining: 'public jwk not found for kid',
            });
        }
    });

    test('credential manifest jwt without kid returns request invalid', async () => {
        const entryPoint = issuingEntryPoint();
        const { error } = await callEntryPoint(entryPoint, {
            router: {
                requestPayload: {
                    issuing_request: jwtWithoutKid(
                        CredentialManifestMocks.JwtCredentialManifest1,
                    ),
                },
            },
        });

        assertTaxonomyError(entryPoint, error, 'request_validation', {
            errorCode: VCLErrorCode.IssuerRequestInvalid,
            sourceErrorCode: VCLErrorCode.SdkError,
            requestDid: entryPoint.did,
            messageContaining: 'Empty credentialManifest.jwt.kid',
        });
    });

    test('credential manifest by service succeeds without deep link verification', async () => {
        const { result } = await callEntryPoint(issuingEntryPoint(), {
            endpoint: DeepLinkMocks.CredentialManifestRequestDecodedUriStr,
        });
        const credentialManifest = result as {
            deepLink: VCLDeepLink | null;
            did: string;
        };

        expect(credentialManifest.deepLink).toBeNull();
        expect(credentialManifest.did).toEqual(DeepLinkMocks.IssuerDid);
    });

    test('verified profile 404 returns not registered', async () => {
        for (const entryPoint of entryPoints) {
            const payload =
                '{"message":"profile missing","errorCode":"sdk_error"}';
            const { error } = await callEntryPoint(entryPoint, {
                router: {
                    verifiedProfileStatusCode: 404,
                    verifiedProfilePayload: payload,
                    verifiedProfileContentType: jsonContentType,
                },
            });

            assertTaxonomyError(entryPoint, error, 'registration_check', {
                payload,
                errorCode: entryPoint.notRegisteredCode,
                sourceErrorCode: VCLErrorCode.SdkError,
                statusCode: 404,
                requestDid: entryPoint.did,
                message: 'profile missing',
            });
        }
    });

    test('verified profile transport failure returns connectivity failure', async () => {
        for (const entryPoint of entryPoints) {
            const { error } = await callEntryPoint(entryPoint, {
                router: {
                    verifiedProfileFailure: new Error('profile offline'),
                },
            });

            assertTaxonomyError(entryPoint, error, 'registration_check', {
                errorCode: VCLErrorCode.ConnectivityFailure,
                statusCode: VCLStatusCode.NetworkError,
                requestDid: entryPoint.did,
                messageContaining: 'profile offline',
            });
        }
    });

    test('verified profile unexpected 4xx and 5xx are registration check inconclusive', async () => {
        for (const entryPoint of entryPoints) {
            for (const statusCode of [400, 500]) {
                const payload = `{"message":"profile lookup failed","errorCode":"${VCLErrorCode.SdkError}"}`;
                const { error } = await callEntryPoint(entryPoint, {
                    router: {
                        verifiedProfileStatusCode: statusCode,
                        verifiedProfilePayload: payload,
                        verifiedProfileContentType: jsonContentType,
                    },
                });

                assertTaxonomyError(entryPoint, error, 'registration_check', {
                    payload,
                    errorCode: VCLErrorCode.RegistrationCheckInconclusive,
                    sourceErrorCode: VCLErrorCode.SdkError,
                    statusCode,
                    requestDid: entryPoint.did,
                    message: 'profile lookup failed',
                });
            }
        }
    });

    test('empty and malformed json verified profile 200 responses are registration check inconclusive', async () => {
        for (const entryPoint of entryPoints) {
            for (const { router, messageContaining } of [
                {
                    router: { verifiedProfilePayload: {} },
                    messageContaining: 'Malformed verified profile',
                },
                {
                    router: {
                        verifiedProfilePayload: '{not json',
                        verifiedProfileContentType: jsonContentType,
                    },
                    messageContaining: 'Malformed verified profile',
                },
            ]) {
                const { error } = await callEntryPoint(entryPoint, {
                    router,
                });

                assertTaxonomyError(entryPoint, error, 'registration_check', {
                    errorCode: VCLErrorCode.RegistrationCheckInconclusive,
                    sourceErrorCode: SourceMalformedVerifiedProfile,
                    requestDid: entryPoint.did,
                    messageContaining,
                });
            }
        }
    });

    test('verified profile with missing service types reaches service type authorization', async () => {
        for (const entryPoint of entryPoints) {
            const { error } = await callEntryPoint(entryPoint, {
                router: {
                    verifiedProfilePayload: {
                        credentialSubject: {
                            name: 'No Service Types, Inc.',
                        },
                    },
                },
            });

            assertTaxonomyError(entryPoint, error, 'request_authorization', {
                errorCode: entryPoint.requestUnauthorizedCode,
                sourceErrorCode:
                    ProfileServiceTypeVerifier.SourceWrongServiceType,
                statusCode: VCLStatusCode.VerificationError,
                requestDid: entryPoint.did,
                messageContaining: 'Wrong service type',
            });
        }
    });

    test('wrong issuer or verifier service type returns sdk_error with verification status', async () => {
        for (const entryPoint of entryPoints) {
            const wrongServiceProfile =
                entryPoint.type === 'issuing'
                    ? VerifiedProfileMocks.readonlyVerifiedProfileInspectorJsonStr
                    : VerifiedProfileMocks.VerifiedProfileIssuerJsonStr1;
            const { error } = await callEntryPoint(entryPoint, {
                router: {
                    verifiedProfilePayload: JSON.parse(wrongServiceProfile),
                },
            });

            assertTaxonomyError(entryPoint, error, 'request_authorization', {
                errorCode: entryPoint.requestUnauthorizedCode,
                sourceErrorCode:
                    ProfileServiceTypeVerifier.SourceWrongServiceType,
                statusCode: VCLStatusCode.VerificationError,
                requestDid: entryPoint.did,
                messageContaining: 'Wrong service type',
            });
        }
    });

    test('duplicate query params use last did value at sdk entry point', async () => {
        for (const entryPoint of entryPoints) {
            const deepLink = new VCLDeepLink(
                `velocity-network://${entryPoint.schemePath}?request_uri=${entryPoint.encodedRequestUri}` +
                    `&${entryPoint.didParam}=did:example:first&${entryPoint.didParam}=${entryPoint.lastDid}`,
            );
            const { capturedRequest, error } = await callEntryPoint(
                entryPoint,
                { deepLink },
            );

            assertTaxonomyError(entryPoint, error, 'request_validation', {
                errorCode: entryPoint.requestInvalidCode,
                sourceErrorCode: entryPoint.legacyMismatchErrorCode,
                requestDid: entryPoint.did,
            });
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
            const { error } = await callEntryPoint(entryPoint, {
                deepLink,
            });

            assertTaxonomyError(entryPoint, error, 'request_validation', {
                errorCode: entryPoint.requestInvalidCode,
                sourceErrorCode: entryPoint.legacyMismatchErrorCode,
                requestDid: entryPoint.did,
            });
        }
    });

    test('jwt verification failure propagates sdk_error from injected jwt service', async () => {
        const expectedError = new VCLError({
            errorCode: VCLErrorCode.SdkError,
            message: 'jwt signature verification failed',
        });

        for (const entryPoint of entryPoints) {
            const { error } = await callEntryPoint(entryPoint, {
                jwtVerificationError: expectedError,
            });

            assertTaxonomyError(entryPoint, error, 'request_validation', {
                errorCode: entryPoint.requestInvalidCode,
                sourceErrorCode: VCLErrorCode.SdkError,
                requestDid: entryPoint.did,
                message: 'jwt signature verification failed',
            });
        }
    });
});

const assertTaxonomyError = (
    entryPoint: EntryPoint,
    actual: VCLError,
    validationPhase: ValidationPhase,
    expectation: TaxonomyErrorExpectation,
) => {
    const { message, messageContaining, ...diagnostics } = expectation;
    const expected = expectedTaxonomyError(
        entryPoint,
        validationPhase,
        diagnostics,
    );
    expect(toDiagnostics(actual)).toEqual({
        ...expected,
        payload: canonicalJsonOrSelf(expected.payload),
    });
    if (message != null) {
        expect(actual.message).toEqual(message);
    }
    if (messageContaining != null) {
        expect(actual.message).toContain(messageContaining);
    }
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

const expectedTaxonomyError = (
    entryPoint: EntryPoint,
    validationPhase: ValidationPhase,
    diagnostics: ErrorDiagnosticOverrides,
): ErrorDiagnostics => ({
    payload: null,
    error: null,
    sourceErrorCode: null,
    requestId: null,
    statusCode: null,
    requestDid: null,
    requestUri: null,
    requestKind: entryPoint.requestKind,
    validationPhase,
    ...diagnostics,
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

const jwtWithoutKid = (jwt: string) => {
    const [, payload, signature] = jwt.split('.');
    const header = Buffer.from(
        JSON.stringify({
            typ: 'JWT',
            alg: 'ES256K',
        }),
    ).toString('base64url');

    return `${header}.${payload}.${signature}`;
};

const jwtWithoutPayloadClaim = (jwt: string, claim: string) => {
    const [header, payload, signature] = jwt.split('.');
    const decodedPayload = JSON.parse(
        Buffer.from(payload, 'base64url').toString('utf8'),
    );
    delete decodedPayload[claim];

    return `${header}.${Buffer.from(JSON.stringify(decodedPayload)).toString(
        'base64url',
    )}.${signature}`;
};
