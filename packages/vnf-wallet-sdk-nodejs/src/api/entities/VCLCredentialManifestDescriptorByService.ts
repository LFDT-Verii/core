import { Nullish } from '../VCLTypes';
import VCLCredentialManifestDescriptor from './VCLCredentialManifestDescriptor';
import { VCLIssuingType } from './VCLIssuingType';
import VCLPushDelegate from './VCLPushDelegate';
import VCLService from './VCLService';
import VCLToken from './VCLToken';
import VCLDidJwk from './VCLDidJwk';

export default class VCLCredentialManifestDescriptorByService extends VCLCredentialManifestDescriptor {
    private readonly didInput: string;

    constructor(
        service: VCLService,
        issuingType: VCLIssuingType = VCLIssuingType.Career,
        credentialTypes: Nullish<string[]> = null,
        pushDelegate: Nullish<VCLPushDelegate> = null,
        didJwk: VCLDidJwk,
        did: string,
        remoteCryptoServicesToken: Nullish<VCLToken> = null
    ) {
        super(
            service.serviceEndpoint,
            issuingType,
            credentialTypes,
            pushDelegate,
            null,
            null,
            didJwk,
            remoteCryptoServicesToken
        );
        this.didInput = did;
    }

    get did(): string {
        return this.didInput;
    }
}
