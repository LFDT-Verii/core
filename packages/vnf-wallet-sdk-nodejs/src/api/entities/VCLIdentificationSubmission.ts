import VCLCredentialManifest from './VCLCredentialManifest';
import VCLSubmission from './VCLSubmission';
import VCLVerifiableCredential from './VCLVerifiableCredential';

export default class VCLIdentificationSubmission extends VCLSubmission {
    constructor(
        public readonly credentialManifest: VCLCredentialManifest,
        public readonly verifiableCredentials: VCLVerifiableCredential[]
    ) {
        super(
            credentialManifest.submitPresentationUri,
            credentialManifest.exchangeId,
            credentialManifest.presentationDefinitionId,
            verifiableCredentials,
            null,
            credentialManifest.vendorOriginContext,
            credentialManifest.didJwk,
            credentialManifest.remoteCryptoServicesToken
        );
    }
}
