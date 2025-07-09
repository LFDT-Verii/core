import { Nullish } from '../VCLTypes';
import VCLDeepLink from './VCLDeepLink';
import VCLPushDelegate from './VCLPushDelegate';
import VCLToken from './VCLToken';
import VCLDidJwk from './VCLDidJwk';
import { appendQueryParamsToString } from '../../impl/utils/HelperFunctions';

export default class VCLPresentationRequestDescriptor {
    readonly did: Nullish<string>;

    constructor(
        public readonly deepLink: VCLDeepLink,
        public readonly pushDelegate: Nullish<VCLPushDelegate> = null,
        public readonly didJwk: VCLDidJwk,
        public readonly remoteCryptoServicesToken: Nullish<VCLToken> = null
    ) {
        this.did = this.deepLink.did;
    }

    get endpoint() {
        const queryParams = this.generateQueryParams();
        if (queryParams) {
            return appendQueryParamsToString(
                this.deepLink.requestUri,
                queryParams
            );
        }
        return this.deepLink.requestUri;
    }

    generateQueryParams() {
        let pPushDelegate: Nullish<string>;
        if (this.pushDelegate) {
            pPushDelegate = `${
                VCLPresentationRequestDescriptor.KeyPushDelegatePushUrl
            }=${encodeURIComponent(this.pushDelegate.pushUrl)}&${
                VCLPresentationRequestDescriptor.KeyPushDelegatePushToken
            }=${this.pushDelegate.pushToken}`;
        }

        const qParams = [pPushDelegate].filter((it) => it && it.length);
        return qParams.length ? qParams.join('&') : null;
    }

    static readonly KeyId = 'id';

    static readonly KeyPushDelegatePushUrl = 'push_delegate.push_url';

    static readonly KeyPushDelegatePushToken = 'push_delegate.push_token';
}
