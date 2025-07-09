import { Dictionary, Nullish } from '../VCLTypes';
import VCLCredentialManifest from './VCLCredentialManifest';
import VCLVerifiableCredential from './VCLVerifiableCredential';

export default class VCLGenerateOffersDescriptor {
    constructor(
        public readonly credentialManifest: VCLCredentialManifest,
        public readonly types: Nullish<string[]> = null,
        public readonly offerHashes: Nullish<string[]> = null,
        public readonly identificationVerifiableCredentials: VCLVerifiableCredential[]
    ) {}

    payload: Dictionary<any> = {
        [VCLGenerateOffersDescriptor.KeyExchangeId]: this.exchangeId,
        [VCLGenerateOffersDescriptor.KeyTypes]: this.types,
        [VCLGenerateOffersDescriptor.KeyOfferHashes]: this.offerHashes,
    };

    get exchangeId() {
        return this.credentialManifest.exchangeId;
    }

    get checkOffersUri() {
        return this.credentialManifest.checkOffersUri;
    }

    get did() {
        return this.credentialManifest.did;
    }

    static readonly KeyExchangeId = 'exchangeId';

    static readonly KeyTypes = 'types';

    static readonly KeyOfferHashes = 'offerHashes';
}
