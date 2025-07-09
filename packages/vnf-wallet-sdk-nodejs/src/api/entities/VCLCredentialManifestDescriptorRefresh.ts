import { Nullish } from '../VCLTypes';
import VCLCredentialManifestDescriptor from './VCLCredentialManifestDescriptor';
import { VCLIssuingType } from './VCLIssuingType';
import VCLService from './VCLService';
import VCLDidJwk from './VCLDidJwk';
import VCLToken from './VCLToken';

export default class VCLCredentialManifestDescriptorRefresh extends VCLCredentialManifestDescriptor {
    private readonly didInput: string;

    constructor(
        service: VCLService,
        public readonly credentialIds: string[],
        didJwk: VCLDidJwk,
        did: string,
        remoteCryptoServicesToken: Nullish<VCLToken> = null
    ) {
        super(
            service.serviceEndpoint,
            VCLIssuingType.Refresh,
            null,
            null,
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

    get endpoint(): Nullish<string> {
        const queryParams = this.generateQueryParams();
        if (queryParams) {
            const originUri = this.uri!;
            const allQueryParams = `${originUri.includes('?') ? '&' : '?'}${
                VCLCredentialManifestDescriptorRefresh.KeyRefresh
            }=true&${queryParams}`;
            return this.uri + allQueryParams;
        }

        return `${this.uri!}?${
            VCLCredentialManifestDescriptorRefresh.KeyRefresh
        }=true`;
    }

    generateQueryParams() {
        const pCredentialIds = this.credentialIds
            .map(
                (it) =>
                    `${
                        VCLCredentialManifestDescriptorRefresh.KeyCredentialId
                    }=${encodeURIComponent(it)}`
            )
            .join('&');

        const qParams = [pCredentialIds].filter((c) => c && c.length);
        return qParams.length ? qParams.join('&') : null;
    }
}
