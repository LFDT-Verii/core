// eslint-disable-next-line no-shadow
export enum VCLIssuingType {
    Career = 'Career',
    Identity = 'Identity',
    Refresh = 'Refresh',
    Undefined = 'Undefined',
}

export const issuingTypeFromString = (value: string): VCLIssuingType => {
    if (value.includes(VCLIssuingType.Career)) {
        return VCLIssuingType.Career;
    }
    if (value.includes(VCLIssuingType.Identity)) {
        return VCLIssuingType.Identity;
    }
    if (value.includes(VCLIssuingType.Refresh)) {
        return VCLIssuingType.Refresh;
    }
    return VCLIssuingType.Undefined;
};
