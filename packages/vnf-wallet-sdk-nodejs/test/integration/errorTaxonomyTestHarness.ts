import nock from 'nock';
import {
    VCLEnvironment,
    VCLError,
    VCLErrorCode,
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
    VCLToken,
    VCLXVnfProtocolVersion,
} from '../../src';
import type { VCLErrorCodeCompatibilityMode } from '../../src/api/entities/initialization/VCLInitializationDescriptor';
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
import { ProfileServiceTypeVerifier } from '../../src/impl/utils/ProfileServiceTypeVerifier';
import { JwtSignServiceMock } from '../infrastructure/resources/jwt/JwtSignServiceMock';
import { KeyServiceMock } from '../infrastructure/resources/key/KeyServiceMock';
import { CredentialManifestMocks } from '../infrastructure/resources/valid/CredentialManifestMocks';
import { DeepLinkMocks } from '../infrastructure/resources/valid/DeepLinkMocks';
import { DidDocumentMocks } from '../infrastructure/resources/valid/DidDocumentMocks';
import { DidJwkMocks } from '../infrastructure/resources/valid/DidJwkMocks';
import { PresentationRequestMocks } from '../infrastructure/resources/valid/PresentationRequestMocks';
import { VerifiedProfileMocks } from '../infrastructure/resources/valid/VerifiedProfileMocks';
import { mockRegistrarGet } from '../utils/nock';

export const jsonContentType = Request.ContentTypeApplicationJson;

const registrarOrigin = 'https://registrar.velocitynetwork.foundation';

export type EntryPoint = {
    defaultDeepLink: VCLDeepLink;
    did: string;
    didParam: string;
    didUnresolvableCode: string;
    encodedRequestUri: string;
    endpointNullMessage: string;
    lastDid: string;
    legacyMismatchErrorCode: string;
    mismatchErrorCode: string;
    notRegisteredCode: string;
    otherDidParam: string;
    requestInvalidCode: string;
    requestKind: string;
    requestUnauthorizedCode: string;
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
    verifiedProfileFailure?: Error;
    verifiedProfilePayload?: unknown;
    verifiedProfileStatusCode?: number;
};

type CapturedRequest = {
    urls: string[];
};

type EntryPointCallOptions = {
    compatibilityMode?: VCLErrorCodeCompatibilityMode;
    deepLink?: VCLDeepLink;
    did?: string;
    endpoint?: string | null;
    jwtVerificationError?: VCLError;
    router?: BaselineRouter;
};

type EntryPointCallResult = {
    capturedRequest: CapturedRequest;
    error: VCLError | null;
    result: unknown | null;
};

export const resetGlobalConfig = () => {
    GlobalConfig.init(
        false,
        VCLEnvironment.Prod,
        VCLXVnfProtocolVersion.XVnfProtocolVersion1,
        true,
    );
};

export const entryPoints: EntryPoint[] = [
    {
        defaultDeepLink: DeepLinkMocks.CredentialManifestDeepLinkDevNet,
        did: DeepLinkMocks.IssuerDid,
        didParam: 'issuerDid',
        didUnresolvableCode: VCLErrorCode.IssuerDidUnresolvable,
        encodedRequestUri: DeepLinkMocks.CredentialManifestRequestUriStr,
        endpointNullMessage: 'credentialManifestDescriptor.endpoint = null',
        lastDid: 'did:example:last',
        legacyMismatchErrorCode: VCLErrorCode.MismatchedRequestIssuerDid,
        mismatchErrorCode: VCLErrorCode.MismatchedRequestIssuerDid,
        notRegisteredCode: VCLErrorCode.IssuerNotRegistered,
        otherDidParam: 'inspectorDid',
        requestInvalidCode: VCLErrorCode.IssuerRequestInvalid,
        requestKind: 'issuing_request',
        requestUnauthorizedCode: VCLErrorCode.IssuerRequestUnauthorized,
        requestUri: DeepLinkMocks.CredentialManifestRequestUriStr,
        schemePath: 'issue',
        type: 'issuing',
    },
    {
        defaultDeepLink: DeepLinkMocks.PresentationRequestDeepLinkDevNet,
        did: DeepLinkMocks.InspectorDid,
        didParam: 'inspectorDid',
        didUnresolvableCode: VCLErrorCode.VerifierDidUnresolvable,
        encodedRequestUri: DeepLinkMocks.PresentationRequestRequestUriStr,
        endpointNullMessage: 'presentationRequestDescriptor.endpoint = null',
        lastDid: 'did:example:last',
        legacyMismatchErrorCode:
            VCLErrorCode.MismatchedPresentationRequestInspectorDid,
        mismatchErrorCode:
            VCLErrorCode.MismatchedPresentationRequestInspectorDid,
        notRegisteredCode: VCLErrorCode.VerifierNotRegistered,
        otherDidParam: 'issuerDid',
        requestInvalidCode: VCLErrorCode.VerifierRequestInvalid,
        requestKind: 'presentation_request',
        requestUnauthorizedCode: VCLErrorCode.VerifierRequestUnauthorized,
        requestUri: DeepLinkMocks.PresentationRequestRequestUriStr,
        schemePath: 'inspect',
        type: 'presentation',
    },
];

export const callEntryPoint = async (
    entryPoint: EntryPoint,
    {
        compatibilityMode = 'taxonomy',
        deepLink = entryPoint.defaultDeepLink,
        did,
        endpoint,
        jwtVerificationError,
        router = {},
    }: EntryPointCallOptions = {},
): Promise<EntryPointCallResult> => {
    const capturedRequest = { urls: [] };
    const vcl = initializedVcl(jwtVerificationError, compatibilityMode);
    let request;

    if (entryPoint.type === 'issuing') {
        const descriptor = credentialManifestEntryPointDescriptor({
            deepLink,
            did,
            endpoint,
        });

        setupRouter(entryPoint, descriptor, router, capturedRequest);
        request = vcl.getCredentialManifest(descriptor);
    } else {
        const descriptor = presentationDescriptor(deepLink);

        setupRouter(entryPoint, descriptor, router, capturedRequest);
        request = vcl.getPresentationRequest(descriptor);
    }

    return entryPointResult(request, capturedRequest);
};

const entryPointResult = async (
    request: Promise<unknown>,
    capturedRequest: CapturedRequest,
): Promise<EntryPointCallResult> => {
    try {
        const result = await request;
        return {
            capturedRequest,
            error: null,
            result,
        };
    } catch (error) {
        if (!(error instanceof VCLError)) {
            throw error;
        }
        return {
            capturedRequest,
            error,
            result: null,
        };
    }
};

const credentialManifestEntryPointDescriptor = ({
    deepLink,
    did,
    endpoint,
}: Pick<EntryPointCallOptions, 'deepLink' | 'did' | 'endpoint'>) =>
    endpoint !== undefined || did !== undefined
        ? credentialManifestDescriptorByService({ endpoint, did })
        : credentialManifestDescriptor(deepLink!);

export const callLegacyEntryPoint = (
    entryPoint: EntryPoint,
    options: EntryPointCallOptions = {},
) => callEntryPoint(entryPoint, { ...options, compatibilityMode: 'legacy' });

const initializedVcl = (
    jwtVerificationError?: VCLError,
    compatibilityMode: VCLErrorCodeCompatibilityMode = 'taxonomy',
): VCLImpl => {
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
        false,
        undefined,
        compatibilityMode,
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
    endpoint?: string | null;
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

export const didDocumentWithRequestVerificationKeyRemoved = (
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

export const issuingEntryPoint = () =>
    entryPoints.find((entryPoint) => entryPoint.type === 'issuing')!;

const setupRouter = (
    entryPoint: EntryPoint,
    descriptor:
        VCLCredentialManifestDescriptor | VCLPresentationRequestDescriptor,
    router: BaselineRouter,
    capturedRequest?: CapturedRequest,
) => {
    mockVerifiedProfileForDid(
        entryPoint,
        safeDescriptorDid(descriptor) ?? entryPoint.did,
        router,
    );

    const { endpoint } = descriptor;
    if (endpoint && isHttpUrl(endpoint)) {
        mockSdkRequestEndpoint(entryPoint, endpoint, router, capturedRequest);
    }

    mockDidDocument(entryPoint, router);
};

const mockVerifiedProfileForDid = (
    entryPoint: EntryPoint,
    did: string,
    {
        verifiedProfileContentType = jsonContentType,
        verifiedProfileFailure,
        verifiedProfilePayload = defaultVerifiedProfilePayload(entryPoint),
        verifiedProfileStatusCode = 200,
    }: BaselineRouter,
) => {
    const path = `/api/v0.6/organizations/${did}/verified-profile`;

    const interceptor = nock(registrarOrigin).get(
        (uri) => uri === path || decodeURIComponent(uri) === path,
    );

    if (verifiedProfileFailure) {
        interceptor.replyWithError(verifiedProfileFailure.message);
        return;
    }

    interceptor.reply(
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

const safeDescriptorDid = (
    descriptor:
        VCLCredentialManifestDescriptor | VCLPresentationRequestDescriptor,
) => {
    try {
        return descriptor.did;
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
