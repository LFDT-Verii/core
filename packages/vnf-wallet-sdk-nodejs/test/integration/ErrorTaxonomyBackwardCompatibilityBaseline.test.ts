/* eslint-disable no-await-in-loop */
import { beforeEach, describe, test } from 'node:test';
import { expect } from 'expect';
import { VCLError, VCLErrorCode, VCLDeepLink, VCLStatusCode } from '../../src';
import { ErrorMocks } from '../infrastructure/resources/valid/ErrorMocks';
import { VerifiedProfileMocks } from '../infrastructure/resources/valid/VerifiedProfileMocks';
import { useNockLifecycle } from '../utils/nock';
import {
    entryPoints,
    callLegacyEntryPoint as callEntryPoint,
    issuingEntryPoint,
    jsonContentType,
    resetGlobalConfig,
} from './errorTaxonomyTestHarness';

describe('Error taxonomy backward compatibility baseline', () => {
    useNockLifecycle();

    beforeEach(() => {
        resetGlobalConfig();
    });

    // Link validation -> invalid_link

    test('malformed links and missing required params return sdk_error', async () => {
        for (const entryPoint of entryPoints) {
            const missingDidDeepLink = new VCLDeepLink(
                `velocity-network://${entryPoint.schemePath}`,
            );

            for (const deepLink of [
                new VCLDeepLink('not a url'),
                missingDidDeepLink,
            ]) {
                const { error } = await callEntryPoint(entryPoint, {
                    deepLink,
                });

                expect(error.errorCode).toEqual(VCLErrorCode.SdkError);
                expect(error.message).toContain('did was not found');
            }
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

            expect(error.errorCode).toEqual(VCLErrorCode.SdkError);
            expect(error.message).toEqual(entryPoint.endpointNullMessage);
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

            expect(error.errorCode).toEqual(VCLErrorCode.SdkError);
            expect(error.message).toEqual(entryPoint.endpointNullMessage);
        }
    });

    test('missing direct request did preserves legacy did message', async () => {
        const { error } = await callEntryPoint(issuingEntryPoint(), {
            did: '',
        });

        expect(error.errorCode).toEqual(VCLErrorCode.SdkError);
        expect(error.message).toContain('did was not found');
    });

    test('malformed and disallowed request_uri values reach transport as raw endpoint text', async () => {
        for (const entryPoint of entryPoints) {
            const malformedRequestUriDeepLink = new VCLDeepLink(
                `velocity-network://${entryPoint.schemePath}?request_uri=not-a-url&${entryPoint.didParam}=did:example:entity`,
            );
            const disallowedSchemeDeepLink = new VCLDeepLink(
                `velocity-network://${entryPoint.schemePath}?request_uri=ftp%3A%2F%2Fexample.com%2Frequest&${entryPoint.didParam}=did:example:entity`,
            );
            const { error: malformedRequestUri } = await callEntryPoint(
                entryPoint,
                { deepLink: malformedRequestUriDeepLink },
            );
            const { error: disallowedSchemeRequestUri } = await callEntryPoint(
                entryPoint,
                { deepLink: disallowedSchemeDeepLink },
            );

            expect(malformedRequestUri.errorCode).toEqual(
                VCLErrorCode.SdkError,
            );
            expect(malformedRequestUri.message).toContain(
                'Cannot build URL without prefixUrl or full url',
            );
            expect(disallowedSchemeRequestUri.errorCode).toEqual(
                VCLErrorCode.SdkError,
            );
            expect(disallowedSchemeRequestUri.message).toContain(
                'Cannot build URL without prefixUrl or full url',
            );
        }
    });

    // Client request fetch -> client_request_unauthorized / client_request_rejected

    test('transport failure returns sdk_error without network status', async () => {
        for (const entryPoint of entryPoints) {
            const { error } = await callEntryPoint(entryPoint, {
                router: {
                    requestFailure: new Error('offline'),
                },
            });

            expect(error.errorCode).toEqual(VCLErrorCode.SdkError);
            expect(error.statusCode).toBeNull();
            expect(error.message).toContain('offline');
        }
    });

    test('request endpoint 401 and 403 preserve http status and payload error code', async () => {
        for (const entryPoint of entryPoints) {
            for (const statusCode of [401, 403]) {
                const { error } = await callEntryPoint(entryPoint, {
                    router: {
                        requestStatusCode: statusCode,
                        requestPayload: JSON.parse(ErrorMocks.Payload),
                        requestContentType: jsonContentType,
                    },
                });

                expect(error.errorCode).toEqual(ErrorMocks.ErrorCode);
                expect(error.requestId).toEqual(ErrorMocks.RequestId);
                expect(error.message).toEqual(ErrorMocks.Message);
                expect(error.statusCode).toEqual(statusCode);
            }
        }
    });

    test('request endpoint rejections preserve http status when payload has no statusCode', async () => {
        const { statusCode: _statusCode, ...payloadWithoutStatusCode } =
            JSON.parse(ErrorMocks.Payload);

        for (const entryPoint of entryPoints) {
            for (const statusCode of [400, 404, 409, 410, 422, 500, 502]) {
                const { error } = await callEntryPoint(entryPoint, {
                    router: {
                        requestStatusCode: statusCode,
                        requestPayload: payloadWithoutStatusCode,
                        requestContentType: jsonContentType,
                    },
                });

                expect(error.errorCode).toEqual(ErrorMocks.ErrorCode);
                expect(error.statusCode).toEqual(statusCode);
            }
        }
    });

    test('plain text request endpoint rejections default to sdk_error with http status and generic message', async () => {
        for (const entryPoint of entryPoints) {
            const { error } = await callEntryPoint(entryPoint, {
                router: {
                    requestStatusCode: 500,
                    requestPayload: 'plain text failure',
                    requestContentType: 'text/plain',
                },
            });

            expect(error.errorCode).toEqual(VCLErrorCode.SdkError);
            expect(error.statusCode).toEqual(500);
            expect(error.message).toEqual(
                'Request failed with status code 500',
            );
            expect(error.payload).toEqual('plain text failure');
        }
    });

    test('json request endpoint rejections without errorCode default to sdk_error', async () => {
        const { errorCode: _errorCode, ...payloadWithoutErrorCode } =
            JSON.parse(ErrorMocks.Payload);

        for (const entryPoint of entryPoints) {
            const { error } = await callEntryPoint(entryPoint, {
                router: {
                    requestStatusCode: 422,
                    requestPayload: payloadWithoutErrorCode,
                    requestContentType: jsonContentType,
                },
            });

            expect(error.errorCode).toEqual(VCLErrorCode.SdkError);
            expect(error.requestId).toEqual(ErrorMocks.RequestId);
            expect(error.message).toEqual(ErrorMocks.Message);
            expect(error.statusCode).toEqual(422);
        }
    });

    test('empty request endpoint response returns sdk_error', async () => {
        for (const entryPoint of entryPoints) {
            const { error } = await callEntryPoint(entryPoint, {
                router: {
                    requestPayload: '',
                },
            });

            expect(error.errorCode).toEqual(VCLErrorCode.SdkError);
        }
    });

    test('malformed request endpoint response returns sdk_error with http status', async () => {
        for (const entryPoint of entryPoints) {
            const { error } = await callEntryPoint(entryPoint, {
                router: {
                    requestStatusCode: 502,
                    requestPayload: '{not json',
                    requestContentType: 'text/plain',
                },
            });

            expect(error.errorCode).toEqual(VCLErrorCode.SdkError);
            expect(error.statusCode).toEqual(502);
            expect(error.message).toEqual(
                'Request failed with status code 502',
            );
            expect(error.payload).toEqual('{not json');
        }
    });

    test('missing expected request fields return sdk_error after empty jwt is decoded', async () => {
        for (const entryPoint of entryPoints) {
            const { error } = await callEntryPoint(entryPoint, {
                router: {
                    requestPayload: {},
                },
            });

            expect(error.errorCode).toEqual(VCLErrorCode.SdkError);
        }
    });

    // DID resolution -> issuer_did_unresolvable / verifier_did_unresolvable

    test('did resolution network failure propagates sdk_error and status from network', async () => {
        for (const entryPoint of entryPoints) {
            const { error } = await callEntryPoint(entryPoint, {
                router: {
                    didDocumentStatusCode: 404,
                    didDocumentPayload: {
                        message: 'resolve failed',
                        errorCode: VCLErrorCode.SdkError,
                    },
                    didDocumentContentType: jsonContentType,
                },
            });

            expect(error.errorCode).toEqual(VCLErrorCode.SdkError);
            expect(error.statusCode).toEqual(404);
            expect(error.message).toEqual('resolve failed');
        }
    });

    test('invalid did document shape returns sdk_error at request validation', async () => {
        for (const entryPoint of entryPoints) {
            const { error } = await callEntryPoint(entryPoint, {
                router: {
                    didDocumentPayload: 'not json',
                },
            });

            expect(error.errorCode).toEqual(VCLErrorCode.SdkError);
            expect(error.message.toLowerCase()).toContain(
                entryPoint.type === 'issuing'
                    ? 'public jwk not found for kid'
                    : 'public jwk not found for kid',
            );
        }
    });

    test('missing did document verification material returns sdk_error', async () => {
        for (const entryPoint of entryPoints) {
            const { error } = await callEntryPoint(entryPoint, {
                router: {
                    didDocumentPayload: {},
                },
            });

            expect(error.errorCode).toEqual(VCLErrorCode.SdkError);
            expect(error.message.toLowerCase()).toContain(
                'public jwk not found for kid',
            );
        }
    });

    // Registration / profile check -> issuer_not_registered / verifier_not_registered

    test('verified profile lookup failure propagates network error details', async () => {
        for (const entryPoint of entryPoints) {
            const { error } = await callEntryPoint(entryPoint, {
                router: {
                    verifiedProfileStatusCode: 404,
                    verifiedProfilePayload: {
                        message: 'profile missing',
                        errorCode: VCLErrorCode.SdkError,
                    },
                    verifiedProfileContentType: jsonContentType,
                },
            });

            expect(error.errorCode).toEqual(VCLErrorCode.SdkError);
            expect(error.statusCode).toEqual(404);
            expect(error.message).toEqual('profile missing');
        }
    });

    // Request authorization -> issuer_request_unauthorized / verifier_request_unauthorized

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

            expect(error.errorCode).toEqual(VCLErrorCode.SdkError);
            expect(error.statusCode).toEqual(VCLStatusCode.VerificationError);
            expect(error.message).toContain('Wrong service type');
        }
    });

    // Request validation -> issuer_request_invalid / verifier_request_invalid

    test('duplicate query params use last did value at sdk entry point', async () => {
        for (const entryPoint of entryPoints) {
            const deepLink = new VCLDeepLink(
                `velocity-network://${entryPoint.schemePath}?request_uri=${entryPoint.requestUri}` +
                    `&${entryPoint.didParam}=did:example:first&${entryPoint.didParam}=${entryPoint.lastDid}`,
            );
            const { error } = await callEntryPoint(entryPoint, {
                deepLink,
            });

            expect(error.errorCode).toEqual(entryPoint.mismatchErrorCode);
        }
    });

    test('malformed did syntax is accepted until request validation', async () => {
        for (const entryPoint of entryPoints) {
            const deepLink = new VCLDeepLink(
                `velocity-network://${entryPoint.schemePath}?request_uri=${entryPoint.requestUri}&${entryPoint.didParam}=not-a-did`,
            );
            const { error } = await callEntryPoint(entryPoint, {
                deepLink,
            });

            expect(error.errorCode).toEqual(entryPoint.mismatchErrorCode);
        }
    });

    test('request validation failures use legacy mismatch error codes', async () => {
        for (const entryPoint of entryPoints) {
            const deepLink = new VCLDeepLink(
                `velocity-network://${entryPoint.schemePath}?request_uri=${entryPoint.requestUri}&${entryPoint.didParam}=did:example:wrong`,
            );
            const { error } = await callEntryPoint(entryPoint, {
                deepLink,
            });

            expect(error.errorCode).toEqual(entryPoint.mismatchErrorCode);
        }
    });

    test('jwt verification failure propagates sdk_error from injected jwt service', async () => {
        for (const entryPoint of entryPoints) {
            const { error } = await callEntryPoint(entryPoint, {
                jwtVerificationError: new VCLError({
                    errorCode: VCLErrorCode.SdkError,
                    message: 'jwt signature verification failed',
                }),
            });

            expect(error.errorCode).toEqual(VCLErrorCode.SdkError);
            expect(error.message).toEqual('jwt signature verification failed');
        }
    });
});
