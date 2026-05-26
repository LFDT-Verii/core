/* eslint-disable no-await-in-loop */
import { beforeEach, describe, test } from 'node:test';
import { expect } from 'expect';
import nock from 'nock';
import {
    VCLEnvironment,
    VCLError,
    VCLErrorCode,
    VCLCredentialManifestDescriptorByDeepLink,
    VCLDeepLink,
    VCLIssuingType,
    VCLJwt,
    VCLJwtVerifyService,
    VCLPresentationRequestDescriptor,
    VCLPublicJwk,
    VCLStatusCode,
    VCLToken,
    VCLXVnfProtocolVersion,
} from '../../src';
import { VCLImpl } from '../../src/impl/VCLImpl';
import GlobalConfig from '../../src/impl/GlobalConfig';
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
import Request from '../../src/impl/data/infrastructure/network/Request';
import { ProfileServiceTypeVerifier } from '../../src/impl/utils/ProfileServiceTypeVerifier';
import { JwtSignServiceMock } from '../infrastructure/resources/jwt/JwtSignServiceMock';
import { DeepLinkMocks } from '../infrastructure/resources/valid/DeepLinkMocks';
import { DidDocumentMocks } from '../infrastructure/resources/valid/DidDocumentMocks';
import { DidJwkMocks } from '../infrastructure/resources/valid/DidJwkMocks';
import { ErrorMocks } from '../infrastructure/resources/valid/ErrorMocks';
import { PresentationRequestMocks } from '../infrastructure/resources/valid/PresentationRequestMocks';
import { VerifiedProfileMocks } from '../infrastructure/resources/valid/VerifiedProfileMocks';
import { mockRegistrarGet, useNockLifecycle } from '../utils/nock';
import { CredentialManifestMocks } from '../infrastructure/resources/valid/CredentialManifestMocks';

const jsonContentType = Request.ContentTypeApplicationJson;
const registrarOrigin = 'https://registrar.velocitynetwork.foundation';

type EntryPoint = {
    defaultDeepLink: VCLDeepLink;
    did: string;
    didParam: string;
    endpointNullMessage: string;
    lastDid: string;
    mismatchErrorCode: string;
    requestUri: string;
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

describe('Error taxonomy backward compatibility baseline', () => {
    useNockLifecycle();

    beforeEach(() => {
        GlobalConfig.init(
            false,
            VCLEnvironment.Prod,
            VCLXVnfProtocolVersion.XVnfProtocolVersion1,
            true,
        );
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
                const error = await getEntryPointError(entryPoint, deepLink);

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
            const error = await getEntryPointError(entryPoint, deepLink);

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
            const error = await getEntryPointError(entryPoint, deepLink);

            expect(error.errorCode).toEqual(VCLErrorCode.SdkError);
            expect(error.message).toEqual(entryPoint.endpointNullMessage);
        }
    });

    test('malformed and disallowed request_uri values reach transport as raw endpoint text', async () => {
        for (const entryPoint of entryPoints) {
            const malformedRequestUriDeepLink = new VCLDeepLink(
                `velocity-network://${entryPoint.schemePath}?request_uri=not-a-url&${entryPoint.didParam}=did:example:entity`,
            );
            const disallowedSchemeDeepLink = new VCLDeepLink(
                `velocity-network://${entryPoint.schemePath}?request_uri=ftp%3A%2F%2Fexample.com%2Frequest&${entryPoint.didParam}=did:example:entity`,
            );
            const malformedRequestUri = await getEntryPointError(
                entryPoint,
                malformedRequestUriDeepLink,
            );
            const disallowedSchemeRequestUri = await getEntryPointError(
                entryPoint,
                disallowedSchemeDeepLink,
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
            const error = await getEntryPointError(entryPoint, undefined, {
                requestFailure: new Error('offline'),
            });

            expect(error.errorCode).toEqual(VCLErrorCode.SdkError);
            expect(error.statusCode).toBeNull();
            expect(error.message).toContain('offline');
        }
    });

    test('request endpoint 401 and 403 preserve http status and payload error code', async () => {
        for (const entryPoint of entryPoints) {
            for (const statusCode of [401, 403]) {
                const error = await getEntryPointError(entryPoint, undefined, {
                    requestStatusCode: statusCode,
                    requestPayload: JSON.parse(ErrorMocks.Payload),
                    requestContentType: jsonContentType,
                });

                expect(error.errorCode).toEqual(ErrorMocks.ErrorCode);
                expect(error.requestId).toEqual(ErrorMocks.RequestId);
                expect(error.message).toEqual(ErrorMocks.Message);
                expect(error.statusCode).toEqual(ErrorMocks.StatusCode);
            }
        }
    });

    test('request endpoint rejections preserve http status when payload has no statusCode', async () => {
        const { statusCode: _statusCode, ...payloadWithoutStatusCode } =
            JSON.parse(ErrorMocks.Payload);

        for (const entryPoint of entryPoints) {
            for (const statusCode of [400, 404, 409, 410, 422, 500, 502]) {
                const error = await getEntryPointError(entryPoint, undefined, {
                    requestStatusCode: statusCode,
                    requestPayload: payloadWithoutStatusCode,
                    requestContentType: jsonContentType,
                });

                expect(error.errorCode).toEqual(ErrorMocks.ErrorCode);
                expect(error.statusCode).toEqual(statusCode);
            }
        }
    });

    test('plain text request endpoint rejections default to sdk_error with http status and generic message', async () => {
        for (const entryPoint of entryPoints) {
            const error = await getEntryPointError(entryPoint, undefined, {
                requestStatusCode: 500,
                requestPayload: 'plain text failure',
                requestContentType: 'text/plain',
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
            const error = await getEntryPointError(entryPoint, undefined, {
                requestStatusCode: 422,
                requestPayload: payloadWithoutErrorCode,
                requestContentType: jsonContentType,
            });

            expect(error.errorCode).toEqual(VCLErrorCode.SdkError);
            expect(error.requestId).toEqual(ErrorMocks.RequestId);
            expect(error.message).toEqual(ErrorMocks.Message);
            expect(error.statusCode).toEqual(ErrorMocks.StatusCode);
        }
    });

    test('empty request endpoint response returns sdk_error', async () => {
        for (const entryPoint of entryPoints) {
            const error = await getEntryPointError(entryPoint, undefined, {
                requestPayload: '',
            });

            expect(error.errorCode).toEqual(VCLErrorCode.SdkError);
        }
    });

    test('malformed request endpoint response returns sdk_error', async () => {
        for (const entryPoint of entryPoints) {
            const error = await getEntryPointError(entryPoint, undefined, {
                requestPayload: 'not json',
            });

            expect(error.errorCode).toEqual(VCLErrorCode.SdkError);
        }
    });

    test('missing expected request fields return sdk_error after empty jwt is decoded', async () => {
        for (const entryPoint of entryPoints) {
            const error = await getEntryPointError(entryPoint, undefined, {
                requestPayload: {},
            });

            expect(error.errorCode).toEqual(VCLErrorCode.SdkError);
        }
    });

    // DID resolution -> issuer_did_unresolvable / verifier_did_unresolvable

    test('did resolution network failure propagates sdk_error and status from network', async () => {
        for (const entryPoint of entryPoints) {
            const error = await getEntryPointError(entryPoint, undefined, {
                didDocumentStatusCode: 404,
                didDocumentPayload: {
                    message: 'resolve failed',
                    errorCode: VCLErrorCode.SdkError,
                },
                didDocumentContentType: jsonContentType,
            });

            expect(error.errorCode).toEqual(VCLErrorCode.SdkError);
            expect(error.statusCode).toEqual(404);
            expect(error.message).toEqual('resolve failed');
        }
    });

    test('invalid did document shape returns sdk_error at request validation', async () => {
        for (const entryPoint of entryPoints) {
            const error = await getEntryPointError(entryPoint, undefined, {
                didDocumentPayload: 'not json',
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
            const error = await getEntryPointError(entryPoint, undefined, {
                didDocumentPayload: {},
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
            const error = await getEntryPointError(entryPoint, undefined, {
                verifiedProfileStatusCode: 404,
                verifiedProfilePayload: {
                    message: 'profile missing',
                    errorCode: VCLErrorCode.SdkError,
                },
                verifiedProfileContentType: jsonContentType,
            });

            expect(error.errorCode).toEqual(VCLErrorCode.SdkError);
            expect(error.statusCode).toEqual(404);
            expect(error.message).toEqual('profile missing');
        }
    });

    // Request authorization -> issuer_request_unauthorized / verifier_request_unauthorized

    test('empty verified profile fails service type verification', async () => {
        for (const entryPoint of entryPoints) {
            const error = await getEntryPointError(entryPoint, undefined, {
                verifiedProfilePayload: {},
            });

            expect(error.errorCode).toEqual(VCLErrorCode.SdkError);
            expect(error.statusCode).toEqual(VCLStatusCode.VerificationError);
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
            const error = await getEntryPointError(entryPoint, deepLink);

            expect(error.errorCode).toEqual(entryPoint.mismatchErrorCode);
        }
    });

    test('malformed did syntax is accepted until request validation', async () => {
        for (const entryPoint of entryPoints) {
            const deepLink = new VCLDeepLink(
                `velocity-network://${entryPoint.schemePath}?request_uri=${entryPoint.requestUri}&${entryPoint.didParam}=not-a-did`,
            );
            const error = await getEntryPointError(entryPoint, deepLink);

            expect(error.errorCode).toEqual(entryPoint.mismatchErrorCode);
        }
    });

    test('request validation failures use legacy mismatch error codes', async () => {
        for (const entryPoint of entryPoints) {
            const deepLink = new VCLDeepLink(
                `velocity-network://${entryPoint.schemePath}?request_uri=${entryPoint.requestUri}&${entryPoint.didParam}=did:example:wrong`,
            );
            const error = await getEntryPointError(entryPoint, deepLink);

            expect(error.errorCode).toEqual(entryPoint.mismatchErrorCode);
        }
    });

    test('jwt verification failure propagates sdk_error from injected jwt service', async () => {
        for (const entryPoint of entryPoints) {
            const error = await getEntryPointError(
                entryPoint,
                undefined,
                {},
                undefined,
                new VCLError({
                    errorCode: VCLErrorCode.SdkError,
                    message: 'jwt signature verification failed',
                }),
            );

            expect(error.errorCode).toEqual(VCLErrorCode.SdkError);
            expect(error.message).toEqual('jwt signature verification failed');
        }
    });
});

const entryPoints: EntryPoint[] = [
    {
        defaultDeepLink: DeepLinkMocks.CredentialManifestDeepLinkDevNet,
        did: DeepLinkMocks.IssuerDid,
        didParam: 'issuerDid',
        endpointNullMessage: 'credentialManifestDescriptor.endpoint = null',
        lastDid: 'did:example:last',
        mismatchErrorCode: VCLErrorCode.MismatchedRequestIssuerDid,
        requestUri: DeepLinkMocks.CredentialManifestRequestUriStr,
        schemePath: 'issue',
        type: 'issuing',
    },
    {
        defaultDeepLink: DeepLinkMocks.PresentationRequestDeepLinkDevNet,
        did: DeepLinkMocks.InspectorDid,
        didParam: 'inspectorDid',
        endpointNullMessage: 'presentationRequestDescriptor.endpoint = null',
        lastDid: 'did:example:last',
        mismatchErrorCode:
            VCLErrorCode.MismatchedPresentationRequestInspectorDid,
        requestUri: DeepLinkMocks.PresentationRequestRequestUriStr,
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

const mockVerifiedProfile = (
    entryPoint: EntryPoint,
    deepLink: VCLDeepLink,
    {
        verifiedProfileContentType = jsonContentType,
        verifiedProfilePayload = defaultVerifiedProfilePayload(entryPoint),
        verifiedProfileStatusCode = 200,
    }: BaselineRouter,
) => {
    const did = safeDid(deepLink) ?? entryPoint.did;
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
    const { origin, pathname } = new URL(endpoint);
    const interceptor = nock(origin).get(pathname).query(true);

    if (requestFailure) {
        interceptor.replyWithError(requestFailure);
        return;
    }

    interceptor.reply(
        requestStatusCode,
        function reply() {
            capturedRequest?.urls.push(this.req.path);
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
