import { Nullish } from '../VCLTypes';
import VCLDeepLink from './VCLDeepLink';
import VCLJwt from './VCLJwt';
import VCLPushDelegate from './VCLPushDelegate';
import VCLVerifiedProfile from './VCLVerifiedProfile';
import VCLDidJwk from './VCLDidJwk';
import VCLToken from './VCLToken';

export default class VCLPresentationRequest {
    public readonly feed: boolean;

    public readonly vendorOriginContext: Nullish<string>;

    constructor(
        public readonly jwt: VCLJwt,
        public readonly verifiedProfile: VCLVerifiedProfile,
        public readonly deepLink: VCLDeepLink,
        public readonly pushDelegate: Nullish<VCLPushDelegate> = null,
        public readonly didJwk: VCLDidJwk,
        public readonly remoteCryptoServicesToken: Nullish<VCLToken> = null
    ) {
        this.feed = this.getFeed();
        this.vendorOriginContext = this.getVendorOriginContext();
    }

    get iss() {
        return (
            this.jwt.payload[VCLPresentationRequest.KeyIss]?.toString() ?? ''
        );
    }

    get exchangeId() {
        return (
            this.jwt.payload[
                VCLPresentationRequest.KeyExchangeId
            ]?.toString() ?? ''
        );
    }

    get presentationDefinitionId() {
        return (
            (this.jwt.payload[
                VCLPresentationRequest.KeyPresentationDefinition
            ] ?? {})[VCLPresentationRequest.KeyId] ?? ''
        );
    }

    getVendorOriginContext() {
        return this.deepLink.vendorOriginContext;
    }

    get progressUri() {
        return (
            this.jwt.payload[VCLPresentationRequest.KeyMetadata]?.[
                VCLPresentationRequest.KeyProgressUri
            ] ?? ''
        );
    }

    get submitPresentationUri() {
        return (
            this.jwt.payload[VCLPresentationRequest.KeyMetadata]?.[
                VCLPresentationRequest.KeySubmitPresentationUri
            ] ?? ''
        );
    }

    get authTokenUri() {
        return (
            this.jwt.payload[VCLPresentationRequest.KeyMetadata]?.[
                VCLPresentationRequest.KeyAuthTokenUri
            ] ?? ''
        );
        // return 'https://stagingagent.velocitycareerlabs.io/api/holder/v0.6/org/did:ion:EiC8GZpBYJXt5UhqxZJbixJyMjrGw0yw8yFN6HjaM1ogSw/oauth/token';
    }

    getFeed(): boolean {
        return (
            this.jwt.payload[VCLPresentationRequest.KeyMetadata]?.[
                VCLPresentationRequest.KeyFeed
            ] ?? false
        );
    }

    static readonly KeyId = 'id';

    static readonly KeyIss = 'iss';

    static readonly KeyExchangeId = 'exchange_id';

    static readonly KeyPresentationRequest = 'presentation_request';

    static readonly KeyPresentationDefinition = 'presentation_definition';

    static readonly KeyMetadata = 'metadata';

    static readonly KeyProgressUri = 'progress_uri';

    static readonly KeySubmitPresentationUri = 'submit_presentation_uri';

    static readonly KeyFeed = 'feed';

    static readonly KeyAuthTokenUri = 'auth_token_uri';
}
