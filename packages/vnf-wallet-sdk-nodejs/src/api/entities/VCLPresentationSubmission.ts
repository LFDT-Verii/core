import VCLPresentationRequest from './VCLPresentationRequest';
import VCLSubmission from './VCLSubmission';
import VCLVerifiableCredential from './VCLVerifiableCredential';

export default class VCLPresentationSubmission extends VCLSubmission {
    public readonly progressUri: string;

    constructor(
        presentationRequest: VCLPresentationRequest,
        verifiableCredentials: VCLVerifiableCredential[]
    ) {
        super(
            presentationRequest.submitPresentationUri,
            presentationRequest.exchangeId,
            presentationRequest.presentationDefinitionId,
            verifiableCredentials,
            presentationRequest.pushDelegate,
            presentationRequest.vendorOriginContext,
            presentationRequest.didJwk,
            presentationRequest.remoteCryptoServicesToken
        );
        this.progressUri = presentationRequest.progressUri;
    }
}
