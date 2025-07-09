import { Dictionary, Nullish } from '../VCLTypes';
import VCLServiceType from './VCLServiceType';
import VCLServiceTypes from './VCLServiceTypes';

export default class VCLVerifiedProfile {
    public credentialSubject: Nullish<Dictionary<any>>;

    public name: Nullish<string>;

    public logo: Nullish<string>;

    public id: Nullish<string>;

    public serviceTypes: VCLServiceTypes;

    constructor(public readonly payload: Dictionary<any>) {
        this.credentialSubject =
            this.payload[VCLVerifiedProfile.KeyCredentialSubject];
        this.name = this.credentialSubject
            ? this.credentialSubject[VCLVerifiedProfile.KeyName]
            : null;
        this.logo = this.credentialSubject
            ? this.credentialSubject[VCLVerifiedProfile.KeyLogo]
            : null;
        this.id = this.credentialSubject
            ? this.credentialSubject[VCLVerifiedProfile.KeyId]
            : null;
        this.serviceTypes = this.retrieveServiceTypes(
            this.credentialSubject
                ? this.credentialSubject[VCLVerifiedProfile.KeyServiceType]
                : []
        );
    }

    retrieveServiceTypes(serviceCategoriesJsonArr: any[]) {
        const result = (serviceCategoriesJsonArr ?? []).map(
            (category) =>
                VCLServiceType[category as keyof typeof VCLServiceType]
        );
        return new VCLServiceTypes(result);
    }

    static readonly KeyCredentialSubject = 'credentialSubject';

    static readonly KeyName = 'name';

    static readonly KeyLogo = 'logo';

    static readonly KeyId = 'id';

    static readonly KeyServiceType = 'permittedVelocityServiceCategory';
}
