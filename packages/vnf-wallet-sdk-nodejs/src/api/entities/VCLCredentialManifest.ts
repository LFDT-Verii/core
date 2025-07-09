import { Dictionary, Nullish } from '../VCLTypes';
import VCLJwt from './VCLJwt';
import VCLVerifiedProfile from './VCLVerifiedProfile';
import VCLDeepLink from './VCLDeepLink';
import VCLDidJwk from './VCLDidJwk';
import VCLToken from './VCLToken';

export default class VCLCredentialManifest {
    constructor(
        public readonly jwt: VCLJwt,
        public readonly vendorOriginContext: Nullish<string>,
        public readonly verifiedProfile: VCLVerifiedProfile,
        public readonly deepLink: Nullish<VCLDeepLink> = null,
        public readonly didJwk: VCLDidJwk,
        public readonly remoteCryptoServicesToken: Nullish<VCLToken> = null
    ) {}

    get iss(): string {
        return this.jwt.payload[VCLCredentialManifest.KeyIss] ?? '';
    }

    get did(): string {
        return this.iss;
    }

    get aud(): string {
        return this.retrieveAud();
    }

    get issuerId(): string {
        const { payload } = this.jwt;

        if (!payload) {
            return '';
        }

        const issuer = payload[VCLCredentialManifest.KeyIssuer];

        if (typeof issuer === 'string') {
            return issuer;
        }

        const issuerMap = payload[VCLCredentialManifest.KeyIssuer] as
            | Record<string, any>
            | undefined;
        const issuerId = issuerMap?.[VCLCredentialManifest.KeyId] as
            | string
            | undefined;

        return issuerId ?? '';
    }

    get exchangeId(): string {
        return this.jwt.payload[VCLCredentialManifest.KeyExchangeId] ?? '';
    }

    get presentationDefinitionId(): string {
        return (
            (this.jwt.payload[
                VCLCredentialManifest.KeyPresentationDefinitionId
            ] ?? {})[VCLCredentialManifest.KeyId] ?? ''
        );
    }

    get finalizeOffersUri(): string {
        return (
            (this.jwt.payload[VCLCredentialManifest.KeyMetadata] ?? {})[
                VCLCredentialManifest.KeyFinalizeOffersUri
            ] ?? ''
        );
    }

    get checkOffersUri(): string {
        return (
            (this.jwt.payload[VCLCredentialManifest.KeyMetadata] ?? {})[
                VCLCredentialManifest.KeyCheckOffersUri
            ] ?? ''
        );
    }

    get submitPresentationUri(): string {
        return (
            (this.jwt.payload[VCLCredentialManifest.KeyMetadata] ?? {})[
                VCLCredentialManifest.KeySubmitIdentificationUri
            ] ?? ''
        );
    }

    private retrieveAud(): string {
        const keyMetadata =
            this.jwt.payload[VCLCredentialManifest.KeyMetadata] ?? {};
        const finalizeOffersUri =
            (keyMetadata as Dictionary<any>)[
                VCLCredentialManifest.KeyFinalizeOffersUri
            ] ?? '';
        return finalizeOffersUri.split('/issue/')[0];
    }

    // CodingKeys
    static readonly KeyIssuingRequest: string = 'issuing_request';

    static readonly KeyId: string = 'id';

    static readonly KeyIss: string = 'iss';

    static readonly KeyIssuer: string = 'issuer';

    static readonly KeyExchangeId: string = 'exchange_id';

    static readonly KeyPresentationDefinitionId: string =
        'presentation_definition';

    static readonly KeyMetadata: string = 'metadata';

    static readonly KeyCheckOffersUri: string = 'check_offers_uri';

    static readonly KeyFinalizeOffersUri: string = 'finalize_offers_uri';

    static readonly KeySubmitIdentificationUri: string =
        'submit_presentation_uri';
}
