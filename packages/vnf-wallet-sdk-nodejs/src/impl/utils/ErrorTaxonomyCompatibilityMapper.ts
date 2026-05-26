import VCLError from '../../api/entities/error/VCLError';
import VCLErrorCode from '../../api/entities/error/VCLErrorCode';
import {
    copyError,
    ErrorTaxonomy,
    isTaxonomyError,
    RequestKind,
} from './ErrorTaxonomy';
import { ProfileServiceTypeVerifier } from './ProfileServiceTypeVerifier';
import VelocityDeepLinkValidator from './VelocityDeepLinkValidator';

export default class ErrorTaxonomyCompatibilityMapper {
    map({
        error,
        requestKind,
        endpointNullMessage,
    }: {
        error: VCLError;
        requestKind: RequestKind;
        endpointNullMessage: string;
    }): VCLError {
        switch (error.errorCode) {
            case VCLErrorCode.InvalidLink:
                return this.mapInvalidLink(
                    error,
                    requestKind,
                    endpointNullMessage,
                );
            case VCLErrorCode.ConnectivityFailure:
                return this.legacyCopy(
                    error,
                    VCLErrorCode.SdkError,
                    undefined,
                    {
                        statusCode: null,
                    },
                );
            default:
                return isTaxonomyError(error)
                    ? this.mapTaxonomyError(error)
                    : this.mapNetworkStatus(error);
        }
    }

    private mapInvalidLink(
        error: VCLError,
        requestKind: RequestKind,
        endpointNullMessage: string,
    ): VCLError {
        switch (error.sourceErrorCode) {
            case VelocityDeepLinkValidator.SourceInvalidOrMissingDid:
                return error.requestUri
                    ? this.legacyCopy(error, mismatchErrorCode(requestKind))
                    : this.legacyCopy(
                          error,
                          VCLErrorCode.SdkError,
                          legacyMissingDidMessage,
                      );
            case VelocityDeepLinkValidator.SourceInvalidOrMissingRequestUri:
            case VelocityDeepLinkValidator.SourceInvalidOrMissingRequestEndpoint:
                return this.mapInvalidRequestUri(error, endpointNullMessage);
            case VelocityDeepLinkValidator.SourceUnparseablePayload:
                return this.legacyCopy(
                    error,
                    VCLErrorCode.SdkError,
                    legacyMissingDidMessage,
                );
            default:
                return this.legacyCopy(
                    error,
                    VCLErrorCode.SdkError,
                    endpointNullMessage,
                );
        }
    }

    private mapInvalidRequestUri(
        error: VCLError,
        endpointNullMessage: string,
    ): VCLError {
        if (error.requestUri?.startsWith('ftp://')) {
            return this.legacyCopy(
                error,
                VCLErrorCode.SdkError,
                'Cannot build URL without prefixUrl or full url',
            );
        }
        if (error.requestUri && !error.requestUri.includes('://')) {
            return this.legacyCopy(
                error,
                VCLErrorCode.SdkError,
                'Cannot build URL without prefixUrl or full url',
            );
        }
        return this.legacyCopy(
            error,
            VCLErrorCode.SdkError,
            endpointNullMessage,
        );
    }

    private mapTaxonomyError(error: VCLError): VCLError {
        const networkStatusError = this.mapNetworkStatus(error);
        const { sourceErrorCode } = networkStatusError;
        if (isLegacyPlainTextRequestRejection(networkStatusError)) {
            return this.legacyCopy(
                networkStatusError,
                VCLErrorCode.SdkError,
                `Request failed with status code ${networkStatusError.statusCode}`,
            );
        }
        if (
            !sourceErrorCode ||
            sourceErrorCode === networkStatusError.errorCode ||
            sourceErrorCode ===
                ProfileServiceTypeVerifier.SourceWrongServiceType
        ) {
            return this.legacyCopy(networkStatusError, VCLErrorCode.SdkError);
        }
        return this.legacyCopy(networkStatusError, sourceErrorCode);
    }

    private mapNetworkStatus(error: VCLError): VCLError {
        const payloadStatusCode = payloadStatus(error.payload);
        return payloadStatusCode == null
            ? error
            : copyError(error, { statusCode: payloadStatusCode });
    }

    private legacyCopy(
        error: VCLError,
        errorCode: string,
        message: string | null | undefined = error.message,
        overrides: { statusCode?: number | null } = {},
    ): VCLError {
        return copyError(error, {
            errorCode,
            message: message === undefined ? error.message : message,
            ...optionalStatusCode(overrides),
            sourceErrorCode: null,
            validationPhase: null,
            requestDid: null,
            requestUri: null,
            requestKind: null,
        });
    }
}

const mismatchErrorCode = (requestKind: RequestKind) =>
    requestKind === ErrorTaxonomy.RequestKindPresentation
        ? VCLErrorCode.MismatchedPresentationRequestInspectorDid
        : VCLErrorCode.MismatchedRequestIssuerDid;

const payloadStatus = (payload: string | null | undefined) => {
    try {
        const parsed = payload ? JSON.parse(payload) : null;
        const value = parsed?.[VCLError.KeyStatusCode];
        return typeof value === 'number' ? value : null;
    } catch {
        return null;
    }
};

const optionalStatusCode = (overrides: { statusCode?: number | null }) =>
    Object.prototype.hasOwnProperty.call(overrides, 'statusCode')
        ? { statusCode: overrides.statusCode }
        : {};

const legacyMissingDidMessage = 'did was not found in Velocity link';

const isLegacyPlainTextRequestRejection = (error: VCLError) =>
    error.errorCode === VCLErrorCode.ClientRequestRejected &&
    error.sourceErrorCode === VCLErrorCode.SdkError &&
    error.payload != null &&
    !isJsonString(error.payload);

const isJsonString = (value: string): boolean => {
    try {
        JSON.parse(value);
        return true;
    } catch {
        return false;
    }
};
