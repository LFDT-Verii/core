import { Dictionary } from '../VCLTypes';
import VCLService from './VCLService';
import VCLLog from '../../impl/utils/VCLLog';

export default class VCLOrganization {
    public readonly did: string;

    get serviceCredentialAgentIssuers(): VCLService[] {
        return this.parseServiceCredentialAgentIssuers();
    }

    constructor(public readonly payload: Dictionary<any>) {
        this.did =
            this.payload[VCLOrganization.KeyAlsoKnownAs]?.[0] ??
            this.payload[VCLOrganization.KeyId];
    }

    private parseServiceCredentialAgentIssuers(): VCLService[] {
        const result: VCLService[] = [];

        try {
            const serviceJsonArr = (this.payload[VCLOrganization.KeyService] ??
                []) as Dictionary<any>[];
            if (serviceJsonArr) {
                // eslint-disable-next-line guard-for-in,max-depth,no-restricted-syntax
                for (const i in serviceJsonArr) {
                    const it = serviceJsonArr[i];
                    // eslint-disable-next-line max-depth
                    if (it) {
                        result.push(new VCLService(it));
                    }
                }
            }
        } catch (error) {
            VCLLog.error(
                error,
                'Error while parsing service credential agent issuers'
            );
        }

        return result;
    }

    static readonly KeyService = 'service';

    static readonly KeyAlsoKnownAs = 'knownAs';

    static readonly KeyId = 'id';
}
