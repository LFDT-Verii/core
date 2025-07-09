import { Nullish } from '../VCLTypes';
import { VCLIssuingType } from './VCLIssuingType';
import VCLPushDelegate from './VCLPushDelegate';
import VCLToken from './VCLToken';
import VCLDidJwk from './VCLDidJwk';
import VCLDeepLink from './VCLDeepLink';
import {
    appendQueryParamsToString,
    getUrlSubPathFromString,
} from '../../impl/utils/HelperFunctions';

export default class VCLCredentialManifestDescriptor {
    constructor(
        public readonly uri: Nullish<string> = null,
        public readonly issuingType: VCLIssuingType = VCLIssuingType.Career,
        public readonly credentialTypes: Nullish<string[]> = null,
        public readonly pushDelegate: Nullish<VCLPushDelegate> = null,
        public readonly vendorOriginContext: Nullish<string> = null,
        public readonly deepLink: Nullish<VCLDeepLink>,
        public readonly didJwk: VCLDidJwk,
        public readonly remoteCryptoServicesToken: Nullish<VCLToken> = null
    ) {}

    get did() {
        return this.deepLink?.did;
    }

    get endpoint(): Nullish<string> {
        const params = this.generateQueryParams();
        if (!params) {
            return this.uri;
        }
        return appendQueryParamsToString(this.uri, params);
    }

    generateQueryParams(): Nullish<string> {
        let pCredentialTypes: Nullish<string> = null;
        if (this.credentialTypes) {
            pCredentialTypes = this.credentialTypes
                .map(
                    (it) =>
                        `${
                            VCLCredentialManifestDescriptor.KeyCredentialTypes
                        }=${encodeURIComponent(it)}`
                )
                .join('&');
        }

        let pPushDelegate: Nullish<string> = null;
        if (this.pushDelegate) {
            pPushDelegate = `${
                VCLCredentialManifestDescriptor.KeyPushDelegatePushUrl
            }=${encodeURIComponent(this.pushDelegate.pushUrl)}&${
                VCLCredentialManifestDescriptor.KeyPushDelegatePushToken
            }=${this.pushDelegate.pushToken}`;
        }

        const qParams = [pCredentialTypes, pPushDelegate].filter(
            (it) => it && it !== ''
        );

        return qParams.length > 0 ? qParams.join('&') : null;
    }

    static readonly KeyId = 'id';

    static readonly KeyDidPrefix = 'did:';

    static readonly KeyCredentialTypes = 'credential_types';

    static readonly KeyPushDelegatePushUrl = 'push_delegate.push_url';

    static readonly KeyPushDelegatePushToken = 'push_delegate.push_token';

    static readonly KeyCredentialId = 'credentialId';

    static readonly KeyRefresh = 'refresh';
}
