// eslint-disable-next-line no-shadow
enum VCLServiceType {
    Inspector = 'Inspector',
    Issuer = 'Issuer',
    NotaryIssuer = 'NotaryIssuer',
    CareerIssuer = 'CareerIssuer',
    //    Identity issuer types:
    IdentityIssuer = 'IdentityIssuer',
    IdDocumentIssuer = 'IdDocumentIssuer',
    NotaryIdDocumentIssuer = 'NotaryIdDocumentIssuer',
    ContactIssuer = 'ContactIssuer',
    NotaryContactIssuer = 'NotaryContactIssuer',
    Undefined = 'Undefined',
}
export default VCLServiceType;

// eslint-disable-next-line complexity
export const serviceTypeFromString = (value: string): VCLServiceType => {
    if (value.includes(VCLServiceType.Inspector.toString())) {
        return VCLServiceType.Inspector;
    }
    if (value.includes(VCLServiceType.NotaryIssuer.toString())) {
        return VCLServiceType.NotaryIssuer;
    }
    if (value.includes(VCLServiceType.IdentityIssuer.toString())) {
        return VCLServiceType.IdentityIssuer;
    }
    if (value.includes(VCLServiceType.CareerIssuer.toString())) {
        return VCLServiceType.CareerIssuer;
    }
    if (value.includes(VCLServiceType.NotaryIdDocumentIssuer.toString())) {
        return VCLServiceType.NotaryIdDocumentIssuer;
    }
    if (value.includes(VCLServiceType.IdDocumentIssuer.toString())) {
        return VCLServiceType.IdDocumentIssuer;
    }
    if (value.includes(VCLServiceType.NotaryContactIssuer.toString())) {
        return VCLServiceType.NotaryContactIssuer;
    }
    if (value.includes(VCLServiceType.ContactIssuer.toString())) {
        return VCLServiceType.ContactIssuer;
    }
    if (value.includes(VCLServiceType.Issuer.toString())) {
        return VCLServiceType.Issuer;
    }
    return VCLServiceType.Undefined;
};
