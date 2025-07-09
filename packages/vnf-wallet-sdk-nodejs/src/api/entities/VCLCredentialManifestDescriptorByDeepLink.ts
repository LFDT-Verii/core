import { Nullish } from '../VCLTypes';
import VCLCredentialManifestDescriptor from './VCLCredentialManifestDescriptor';
import VCLDeepLink from './VCLDeepLink';
import { VCLIssuingType } from './VCLIssuingType';
import VCLPushDelegate from './VCLPushDelegate';
import VCLDidJwk from './VCLDidJwk';
import VCLToken from './VCLToken';

export default class VCLCredentialManifestDescriptorByDeepLink extends VCLCredentialManifestDescriptor {
    constructor(
        deeplink: VCLDeepLink,
        issuingType: VCLIssuingType = VCLIssuingType.Career,
        pushDelegate: Nullish<VCLPushDelegate> = null,
        didJwk: VCLDidJwk,
        remoteCryptoServicesToken: Nullish<VCLToken> = null
    ) {
        super(
            deeplink.requestUri,
            issuingType,
            null,
            pushDelegate,
            deeplink.vendorOriginContext,
            deeplink,
            didJwk,
            remoteCryptoServicesToken
        );
    }
}
