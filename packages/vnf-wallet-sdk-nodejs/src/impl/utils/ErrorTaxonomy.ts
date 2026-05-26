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

export const classifyClientRequestFetch = (
    error: VCLError,
    requestUri: string | null,
    requestKind: RequestKind,
) => {
    if (isTaxonomyError(error)) {
        return withMissingTaxonomyContext(error, {
            requestUri,
            requestKind,
            validationPhase: ErrorTaxonomy.PhaseClientRequestFetch,
        });
    }
    if (isConnectivityFailure(error)) {
        return withTaxonomy(error, VCLErrorCode.ConnectivityFailure, {
            validationPhase: ErrorTaxonomy.PhaseClientRequestFetch,
            requestUri,
            requestKind,
        });
    }
    if (error.statusCode === 401 || error.statusCode === 403) {
        return withTaxonomy(error, VCLErrorCode.ClientRequestUnauthorized, {
            validationPhase: ErrorTaxonomy.PhaseClientRequestFetch,
            requestUri,
            requestKind,
        });
    }
    return withTaxonomy(error, VCLErrorCode.ClientRequestRejected, {
        validationPhase: ErrorTaxonomy.PhaseClientRequestFetch,
        requestUri,
        requestKind,
    });
};

export const classifyDidResolution = (
    error: VCLError,
    requestKind: RequestKind,
    requestDid: string | null,
) => {
    if (isTaxonomyError(error)) {
        return withMissingTaxonomyContext(error, {
            requestDid,
            requestKind,
            validationPhase: ErrorTaxonomy.PhaseDidResolution,
        });
    }
    return withTaxonomy(
        error,
        isConnectivityFailure(error)
            ? VCLErrorCode.ConnectivityFailure
            : didUnresolvableCode(requestKind),
        {
            validationPhase: ErrorTaxonomy.PhaseDidResolution,
            requestDid,
            requestKind,
        },
    );
};

export const classifyRegistration = (
    error: VCLError,
    requestKind: RequestKind,
    requestDid: string | null,
) => {
    if (isTaxonomyError(error)) {
        return withMissingTaxonomyContext(error, {
            requestDid,
            requestKind,
            validationPhase: ErrorTaxonomy.PhaseRegistrationCheck,
        });
    }
    return withTaxonomy(
        error,
        isConnectivityFailure(error)
            ? VCLErrorCode.ConnectivityFailure
            : notRegisteredCode(requestKind),
        {
            validationPhase: ErrorTaxonomy.PhaseRegistrationCheck,
            requestDid,
            requestKind,
        },
    );
};

export const classifyServiceAuthorization = (
    error: VCLError,
    requestKind: RequestKind,
    requestDid: string | null,
) =>
    isTaxonomyError(error)
        ? withMissingTaxonomyContext(error, {
              requestDid,
              requestKind,
              validationPhase: ErrorTaxonomy.PhaseRequestAuthorization,
          })
        : withTaxonomy(error, requestUnauthorizedCode(requestKind), {
              validationPhase: ErrorTaxonomy.PhaseRequestAuthorization,
              requestDid,
              requestKind,
          });

export const classifyRequestValidation = (
    error: VCLError,
    requestKind: RequestKind,
    requestDid: string | null,
) => {
    if (isTaxonomyError(error)) {
        return withMissingTaxonomyContext(error, {
            requestDid,
            requestKind,
            validationPhase: ErrorTaxonomy.PhaseRequestValidation,
        });
    }
    return withTaxonomy(
        error,
        isConnectivityFailure(error)
            ? VCLErrorCode.ConnectivityFailure
            : requestInvalidCode(requestKind),
        {
            validationPhase: ErrorTaxonomy.PhaseRequestValidation,
            requestDid,
            requestKind,
        },
    );
};

export const classifyRequestAuthorization = (
    error: VCLError,
    requestDid: string | null = null,
) =>
    isTaxonomyError(error)
        ? withMissingTaxonomyContext(error, {
              requestDid,
              requestKind: ErrorTaxonomy.RequestKindIssuing,
              validationPhase: ErrorTaxonomy.PhaseRequestAuthorization,
          })
        : withTaxonomy(error, VCLErrorCode.IssuerRequestUnauthorized, {
              validationPhase: ErrorTaxonomy.PhaseRequestAuthorization,
              requestDid,
              requestKind: ErrorTaxonomy.RequestKindIssuing,
          });

export const isConnectivityFailure = (error: VCLError) =>
    error.errorCode === VCLErrorCode.ConnectivityFailure ||
    error.statusCode === VCLStatusCode.NetworkError;

export const isTaxonomyError = (error: VCLError) =>
    taxonomyCodes.has(error.errorCode);

export const withMissingTaxonomyContext = (
    error: VCLError,
    context: TaxonomyContext,
) =>
    copyError(error, {
        validationPhase: error.validationPhase ?? context.validationPhase,
        requestDid: error.requestDid ?? context.requestDid,
        requestUri: error.requestUri ?? context.requestUri,
        requestKind: error.requestKind ?? context.requestKind,
    });

export const withTaxonomy = (
    error: VCLError,
    taxonomyCode: VCLErrorCode,
    context: Required<Pick<TaxonomyContext, 'validationPhase'>> &
        TaxonomyContext,
) => {
    if (isTaxonomyError(error)) {
        return withMissingTaxonomyContext(error, context);
    }
    return copyError(error, {
        errorCode: taxonomyCode,
        sourceErrorCode: sourceErrorCodeFor(error, taxonomyCode),
        validationPhase: context.validationPhase,
        requestDid: context.requestDid ?? error.requestDid,
        requestUri: context.requestUri ?? error.requestUri,
        requestKind: context.requestKind ?? error.requestKind,
    });
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
