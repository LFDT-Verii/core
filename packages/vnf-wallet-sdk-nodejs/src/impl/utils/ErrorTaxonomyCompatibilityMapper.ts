import VCLError from '../../api/entities/error/VCLError';
import VCLErrorCode from '../../api/entities/error/VCLErrorCode';
import {
    copyError,
    ErrorTaxonomy,
    isTaxonomyError,
    RequestKind,
    SourceMalformedVerifiedProfile,
} from './ErrorTaxonomy';
import { ProfileServiceTypeVerifier } from './ProfileServiceTypeVerifier';
import VelocityDeepLinkValidator from './VelocityDeepLinkValidator';

export default class ErrorTaxonomyCompatibilityMapper {
    map({
        error,
        requestKind,
    }: {
        error: VCLError;
        requestKind: RequestKind;
    }): VCLError {
        switch (error.errorCode) {
            case VCLErrorCode.InvalidLink:
                return this.mapInvalidLink(error, requestKind);
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
                    : error;
        }
    }

    private mapInvalidLink(
        error: VCLError,
        requestKind: RequestKind,
    ): VCLError {
        const endpointNullMessage = legacyEndpointNullMessage(requestKind);
        switch (error.sourceErrorCode) {
            case VelocityDeepLinkValidator.SourceInvalidOrMissingDid:
                return this.mapInvalidOrMissingDid(error, requestKind);
            case VelocityDeepLinkValidator.SourceInvalidOrMissingRequestUri:
            case VelocityDeepLinkValidator.SourceInvalidOrMissingRequestEndpoint:
                return this.mapInvalidRequestUri(error, endpointNullMessage);
            case VelocityDeepLinkValidator.SourceUnparseablePayload:
                return this.legacyCopy(
                    error,
                    VCLErrorCode.SdkError,
                    legacyMissingDidMessage,
                );
            case VelocityDeepLinkValidator.SourceUnsupportedVelocityLink:
                return this.legacyCopy(
                    error,
                    VCLErrorCode.SdkError,
                    endpointNullMessage,
                );
            default:
                return this.legacyCopy(error, VCLErrorCode.SdkError);
        }
    }

    private mapInvalidOrMissingDid(
        error: VCLError,
        requestKind: RequestKind,
    ): VCLError {
        return error.requestUri
            ? this.legacyCopy(error, mismatchErrorCode(requestKind))
            : this.legacyCopy(
                  error,
                  VCLErrorCode.SdkError,
                  legacyMissingDidMessage,
              );
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
        const { sourceErrorCode } = error;
        if (isLegacyPlainTextRequestRejection(error)) {
            return this.legacyCopy(
                error,
                VCLErrorCode.SdkError,
                `Request failed with status code ${error.statusCode}`,
            );
        }
        if (
            !sourceErrorCode ||
            sourceErrorCode === error.errorCode ||
            sourceErrorCode ===
                ProfileServiceTypeVerifier.SourceWrongServiceType ||
            sourceErrorCode === SourceMalformedVerifiedProfile
        ) {
            return this.legacyCopy(error, VCLErrorCode.SdkError);
        }
        return this.legacyCopy(error, sourceErrorCode);
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

const optionalStatusCode = (overrides: { statusCode?: number | null }) =>
    Object.prototype.hasOwnProperty.call(overrides, 'statusCode')
        ? { statusCode: overrides.statusCode }
        : {};

const legacyMissingDidMessage = 'did was not found in Velocity link';

const legacyEndpointNullMessage = (requestKind: RequestKind) =>
    requestKind === ErrorTaxonomy.RequestKindPresentation
        ? 'presentationRequestDescriptor.endpoint = null'
        : 'credentialManifestDescriptor.endpoint = null';

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
