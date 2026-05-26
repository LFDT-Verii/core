import VCLDeepLink from '../../api/entities/VCLDeepLink';
import VCLError from '../../api/entities/error/VCLError';
import { ErrorTaxonomy, invalidLink, RequestKind } from './ErrorTaxonomy';

export default class VelocityDeepLinkValidator {
    static readonly AllowedVelocitySchemes = new Set([
        'velocity-network:',
        'velocity-network-devnet:',
        'velocity-network-testnet:',
    ]);

    static readonly DidPattern =
        /^did:[a-z0-9]+:[A-Za-z0-9._:%-]+(?:[:/][A-Za-z0-9._:%-]+)*$/;

    static readonly SourceUnparseablePayload =
        'invalid_link_unparseable_payload';

    static readonly SourceUnsupportedVelocityLink =
        'invalid_link_unsupported_velocity_link';

    static readonly SourceInvalidOrMissingDid =
        'invalid_link_invalid_or_missing_did';

    static readonly SourceInvalidOrMissingRequestUri =
        'invalid_link_invalid_or_missing_request_uri';

    static readonly SourceInvalidOrMissingRequestEndpoint =
        'invalid_link_invalid_or_missing_request_endpoint';

    validateDeepLink({
        deepLink,
        expectedPath,
        expectedDidParam,
        requestKind,
    }: {
        deepLink: VCLDeepLink;
        expectedPath: string;
        expectedDidParam: string;
        requestKind: RequestKind;
    }): VCLError | null {
        const parsedUrl = parseUrl(deepLink.value);
        if (!parsedUrl) {
            return invalidLink({
                message: 'Payload is not a parseable URL',
                sourceErrorCode:
                    VelocityDeepLinkValidator.SourceUnparseablePayload,
                requestUri: deepLink.requestUri,
                requestKind,
            });
        }
        if (
            !VelocityDeepLinkValidator.AllowedVelocitySchemes.has(
                parsedUrl.protocol,
            ) ||
            parsedUrl.hostname !== expectedPath
        ) {
            return invalidLink({
                message: `Unsupported Velocity link: ${deepLink.value}`,
                sourceErrorCode:
                    VelocityDeepLinkValidator.SourceUnsupportedVelocityLink,
                requestUri: deepLink.requestUri,
                requestKind,
            });
        }

        const requestDid = expectedDid(deepLink, expectedDidParam);
        if (!isSyntacticallyValidDid(requestDid)) {
            return invalidLink({
                message: 'Invalid or missing DID in Velocity link',
                sourceErrorCode:
                    VelocityDeepLinkValidator.SourceInvalidOrMissingDid,
                requestUri: deepLink.requestUri,
                requestKind,
            });
        }

        if (!this.isAllowedRequestUri(deepLink.requestUri)) {
            return invalidLink({
                message: 'Invalid or missing request_uri in Velocity link',
                sourceErrorCode:
                    VelocityDeepLinkValidator.SourceInvalidOrMissingRequestUri,
                requestUri: deepLink.requestUri,
                requestKind,
            });
        }

        return null;
    }

    validateRequestEndpoint(
        requestUri: string | null | undefined,
        requestKind: RequestKind,
    ): VCLError | null {
        if (!this.isAllowedRequestUri(requestUri)) {
            return invalidLink({
                message: 'Invalid or missing request endpoint',
                sourceErrorCode:
                    VelocityDeepLinkValidator.SourceInvalidOrMissingRequestEndpoint,
                requestUri,
                requestKind,
            });
        }
        return null;
    }

    isAllowedRequestUri(requestUri: string | null | undefined): boolean {
        const parsedUrl = parseUrl(requestUri ?? '');
        return (
            parsedUrl?.protocol === 'http:' || parsedUrl?.protocol === 'https:'
        );
    }
}

const expectedDid = (deepLink: VCLDeepLink, expectedDidParam: string) =>
    queryParam(deepLink.value, expectedDidParam) ??
    queryParam(deepLink.requestUri, expectedDidParam) ??
    didInPath(deepLink.requestUri);

const queryParam = (value: string | null | undefined, key: string) => {
    try {
        return value ? new URL(value).searchParams.get(key) : null;
    } catch {
        return null;
    }
};

const didInPath = (value: string | null | undefined) => {
    try {
        return (
            value
                ?.split('?')[0]
                .split('/')
                .find((it) => it.startsWith(VCLDeepLink.KeyDidPrefix)) ?? null
        );
    } catch {
        return null;
    }
};

const isSyntacticallyValidDid = (did: string | null | undefined) =>
    did ? VelocityDeepLinkValidator.DidPattern.test(did) : false;

const parseUrl = (value: string) => {
    try {
        return new URL(value);
    } catch {
        return null;
    }
};

export const { RequestKindIssuing } = ErrorTaxonomy;
export const { RequestKindPresentation } = ErrorTaxonomy;
