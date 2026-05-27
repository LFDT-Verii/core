import VCLError from '../../api/entities/error/VCLError';
import VCLErrorCode from '../../api/entities/error/VCLErrorCode';
import VCLStatusCode from '../../api/entities/error/VCLStatusCode';

export const ErrorTaxonomy = {
    PhaseLinkValidation: 'link_validation',
    PhaseClientRequestFetch: 'client_request_fetch',
    PhaseDidResolution: 'did_resolution',
    PhaseRegistrationCheck: 'registration_check',
    PhaseRequestValidation: 'request_validation',
    PhaseRequestAuthorization: 'request_authorization',

    RequestKindIssuing: 'issuing_request',
    RequestKindPresentation: 'presentation_request',
} as const;

export type RequestKind =
    | typeof ErrorTaxonomy.RequestKindIssuing
    | typeof ErrorTaxonomy.RequestKindPresentation;

type TaxonomyContext = {
    requestDid?: string | null;
    requestUri?: string | null;
    requestKind?: RequestKind | null;
    validationPhase?: string | null;
};

type RequiredTaxonomyContext = Omit<TaxonomyContext, 'validationPhase'> & {
    validationPhase: string;
};

type RequestTaxonomyContext = Omit<
    TaxonomyContext,
    'requestKind' | 'validationPhase'
> & {
    requestKind: RequestKind;
};

const taxonomyCodes = new Set<string>([
    VCLErrorCode.InvalidLink,
    VCLErrorCode.ConnectivityFailure,
    VCLErrorCode.ClientRequestUnauthorized,
    VCLErrorCode.ClientRequestRejected,
    VCLErrorCode.IssuerDidUnresolvable,
    VCLErrorCode.VerifierDidUnresolvable,
    VCLErrorCode.IssuerNotRegistered,
    VCLErrorCode.VerifierNotRegistered,
    VCLErrorCode.IssuerRequestInvalid,
    VCLErrorCode.VerifierRequestInvalid,
    VCLErrorCode.IssuerRequestUnauthorized,
    VCLErrorCode.VerifierRequestUnauthorized,
]);

export const invalidLink = ({
    message,
    sourceErrorCode = null,
    requestDid = null,
    requestUri = null,
    requestKind = null,
}: {
    message: string;
    sourceErrorCode?: string | null;
    requestDid?: string | null;
    requestUri?: string | null;
    requestKind?: RequestKind | null;
}) =>
    new VCLError({
        errorCode: VCLErrorCode.InvalidLink,
        message,
        sourceErrorCode,
        validationPhase: ErrorTaxonomy.PhaseLinkValidation,
        requestDid,
        requestUri,
        requestKind,
    });

export const toClientRequestFetchError = (
    error: VCLError,
    context: RequestTaxonomyContext,
) =>
    toTaxonomyError(error, clientRequestFetchCode(error), {
        validationPhase: ErrorTaxonomy.PhaseClientRequestFetch,
        ...context,
    });

export const toDidResolutionError = (
    error: VCLError,
    context: RequestTaxonomyContext,
) =>
    toTaxonomyError(
        error,
        isConnectivityFailure(error)
            ? VCLErrorCode.ConnectivityFailure
            : didUnresolvableCode(context.requestKind),
        {
            validationPhase: ErrorTaxonomy.PhaseDidResolution,
            ...context,
        },
    );

export const toRegistrationCheckError = (
    error: VCLError,
    context: RequestTaxonomyContext,
) =>
    toTaxonomyError(
        error,
        isConnectivityFailure(error)
            ? VCLErrorCode.ConnectivityFailure
            : notRegisteredCode(context.requestKind),
        {
            validationPhase: ErrorTaxonomy.PhaseRegistrationCheck,
            ...context,
        },
    );

export const toRequestAuthorizationError = (
    error: VCLError,
    context: RequestTaxonomyContext,
) =>
    toTaxonomyError(error, requestUnauthorizedCode(context.requestKind), {
        validationPhase: ErrorTaxonomy.PhaseRequestAuthorization,
        ...context,
    });

export const toRequestValidationError = (
    error: VCLError,
    context: RequestTaxonomyContext,
) =>
    toTaxonomyError(
        error,
        isConnectivityFailure(error)
            ? VCLErrorCode.ConnectivityFailure
            : requestInvalidCode(context.requestKind),
        {
            validationPhase: ErrorTaxonomy.PhaseRequestValidation,
            ...context,
        },
    );

export const isConnectivityFailure = (error: VCLError) =>
    error.errorCode === VCLErrorCode.ConnectivityFailure ||
    error.statusCode === VCLStatusCode.NetworkError;

export const isTaxonomyError = (error: VCLError) =>
    taxonomyCodes.has(error.errorCode);

export const toTaxonomyError = (
    error: VCLError,
    taxonomyCode: VCLErrorCode,
    context: RequiredTaxonomyContext,
) => {
    if (isTaxonomyError(error)) {
        return copyError(error, missingTaxonomyContext(error, context));
    }
    return copyError(error, taxonomyOverrides(error, taxonomyCode, context));
};

export const copyError = (
    error: VCLError,
    overrides: Partial<{
        payload: string | null;
        error: string | null;
        errorCode: string;
        requestId: string | null;
        message: string | null;
        statusCode: number | null;
        sourceErrorCode: string | null;
        validationPhase: string | null;
        requestDid: string | null;
        requestUri: string | null;
        requestKind: string | null;
    }>,
) =>
    new VCLError({
        payload: valueOr(overrides, 'payload', error.payload),
        error: valueOr(overrides, 'error', error.error),
        errorCode: valueOr(overrides, 'errorCode', error.errorCode),
        requestId: valueOr(overrides, 'requestId', error.requestId),
        message: valueOr(overrides, 'message', error.message),
        statusCode: valueOr(overrides, 'statusCode', error.statusCode),
        sourceErrorCode: valueOr(
            overrides,
            'sourceErrorCode',
            error.sourceErrorCode,
        ),
        validationPhase: valueOr(
            overrides,
            'validationPhase',
            error.validationPhase,
        ),
        requestDid: valueOr(overrides, 'requestDid', error.requestDid),
        requestUri: valueOr(overrides, 'requestUri', error.requestUri),
        requestKind: valueOr(overrides, 'requestKind', error.requestKind),
    });

const sourceErrorCodeFor = (error: VCLError, taxonomyCode: VCLErrorCode) => {
    if (error.sourceErrorCode != null) {
        return error.sourceErrorCode;
    }
    if (
        taxonomyCode === VCLErrorCode.ConnectivityFailure &&
        error.errorCode === VCLErrorCode.SdkError
    ) {
        return null;
    }
    return error.errorCode === taxonomyCode ? null : error.errorCode;
};

const missingTaxonomyContext = (
    error: VCLError,
    context: RequiredTaxonomyContext,
) => ({
    validationPhase: error.validationPhase ?? context.validationPhase,
    requestDid: error.requestDid ?? context.requestDid,
    requestUri: error.requestUri ?? context.requestUri,
    requestKind: error.requestKind ?? context.requestKind,
});

const taxonomyOverrides = (
    error: VCLError,
    taxonomyCode: VCLErrorCode,
    context: RequiredTaxonomyContext,
) => ({
    errorCode: taxonomyCode,
    sourceErrorCode: sourceErrorCodeFor(error, taxonomyCode),
    validationPhase: context.validationPhase,
    requestDid: context.requestDid ?? error.requestDid,
    requestUri: context.requestUri ?? error.requestUri,
    requestKind: context.requestKind ?? error.requestKind,
});

const clientRequestFetchCode = (error: VCLError) => {
    if (isConnectivityFailure(error)) {
        return VCLErrorCode.ConnectivityFailure;
    }
    if (error.statusCode === 401 || error.statusCode === 403) {
        return VCLErrorCode.ClientRequestUnauthorized;
    }
    return VCLErrorCode.ClientRequestRejected;
};

const valueOr = <T, K extends keyof T>(
    source: T,
    key: K,
    fallback: T[K],
): T[K] =>
    Object.prototype.hasOwnProperty.call(source, key) ? source[key] : fallback;

const didUnresolvableCode = (requestKind: RequestKind) =>
    isPresentationRequest(requestKind)
        ? VCLErrorCode.VerifierDidUnresolvable
        : VCLErrorCode.IssuerDidUnresolvable;

const notRegisteredCode = (requestKind: RequestKind) =>
    isPresentationRequest(requestKind)
        ? VCLErrorCode.VerifierNotRegistered
        : VCLErrorCode.IssuerNotRegistered;

const requestInvalidCode = (requestKind: RequestKind) =>
    isPresentationRequest(requestKind)
        ? VCLErrorCode.VerifierRequestInvalid
        : VCLErrorCode.IssuerRequestInvalid;

const requestUnauthorizedCode = (requestKind: RequestKind) =>
    isPresentationRequest(requestKind)
        ? VCLErrorCode.VerifierRequestUnauthorized
        : VCLErrorCode.IssuerRequestUnauthorized;

const isPresentationRequest = (requestKind: RequestKind) =>
    requestKind === ErrorTaxonomy.RequestKindPresentation;
