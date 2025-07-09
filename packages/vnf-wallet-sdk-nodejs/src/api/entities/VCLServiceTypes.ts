import { VCLIssuingType } from './VCLIssuingType';
import VCLServiceType from './VCLServiceType';

export default class VCLServiceTypes {
    constructor(public all: VCLServiceType[]) {}

    static fromIssuingType(issuingType: VCLIssuingType): VCLServiceTypes {
        let all: VCLServiceType[] = [];

        switch (issuingType) {
            case VCLIssuingType.Career:
                all = [
                    VCLServiceType.Issuer,
                    VCLServiceType.CareerIssuer,
                    VCLServiceType.NotaryIssuer,
                ];
                break;
            case VCLIssuingType.Identity:
                all = [VCLServiceType.IdentityIssuer];
                break;
            case VCLIssuingType.Refresh:
                all = [
                    VCLServiceType.Issuer,
                    VCLServiceType.CareerIssuer,
                    VCLServiceType.NotaryIssuer,
                    VCLServiceType.IdentityIssuer,
                ];
                break;
            case VCLIssuingType.Undefined:
                all = [VCLServiceType.Undefined];
                break;
            default:
                all = [VCLServiceType.Undefined];
                break;
        }
        return new VCLServiceTypes(all);
    }

    containsAtLeastOneOf(serviceTypes: VCLServiceTypes): boolean {
        return !!this.all.find((it) => serviceTypes.contains(it));
    }

    contains(serviceType: VCLServiceType): boolean {
        return (
            this.all.includes(serviceType) &&
            serviceType !== VCLServiceType.Undefined
        );
    }
}
