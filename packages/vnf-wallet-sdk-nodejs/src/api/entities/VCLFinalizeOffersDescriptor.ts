import { Dictionary, Nullish } from '../VCLTypes';
import VCLCredentialManifest from './VCLCredentialManifest';
import VCLJwt from './VCLJwt';

export default class VCLFinalizeOffersDescriptor {
    constructor(
        public readonly credentialManifest: VCLCredentialManifest,
        public readonly challenge: Nullish<string>,
        public readonly approvedOfferIds: string[],
        public readonly rejectedOfferIds: string[]
    ) {}

    get didJwk() {
        return this.credentialManifest.didJwk;
    }

    get remoteCryptoServicesToken() {
        return this.credentialManifest.remoteCryptoServicesToken;
    }

    get issuerId() {
        return this.credentialManifest.issuerId;
    }

    get aud() {
        return this.credentialManifest.aud;
    }

    get exchangeId() {
        return this.credentialManifest.exchangeId;
    }

    get finalizeOffersUri() {
        return this.credentialManifest.finalizeOffersUri;
    }

    get serviceTypes() {
        return this.credentialManifest.verifiedProfile.serviceTypes;
    }

    payload: Dictionary<any> = {
        [VCLFinalizeOffersDescriptor.KeyExchangeId]: this.exchangeId,
        [VCLFinalizeOffersDescriptor.KeyApprovedOfferIds]:
            this.approvedOfferIds,
        [VCLFinalizeOffersDescriptor.KeyRejectedOfferIds]:
            this.rejectedOfferIds,
    };

    generateRequestBody(proof: Nullish<VCLJwt> = null): Dictionary<any> {
        const retVal = { ...this.payload };

        if (proof) {
            retVal[VCLFinalizeOffersDescriptor.KeyProof] = {
                [VCLFinalizeOffersDescriptor.KeyProofType]:
                    VCLFinalizeOffersDescriptor.KeyJwt,
                [VCLFinalizeOffersDescriptor.KeyJwt]: proof.encodedJwt,
            };
        }
        return retVal;
    }

    static readonly KeyExchangeId = 'exchangeId';

    static readonly KeyApprovedOfferIds = 'approvedOfferIds';

    static readonly KeyRejectedOfferIds = 'rejectedOfferIds';

    static readonly KeyJwt = 'jwt';

    static readonly KeyProof = 'proof';

    static readonly KeyProofType = 'proof_type';
}
