// eslint-disable-next-line no-shadow
enum VCLXVnfProtocolVersion {
    XVnfProtocolVersion1 = '1.0',
    XVnfProtocolVersion2 = '2.0',
}

export const vnfProtocolVersionFromString = (
    vnfProtocolVersion: string
): VCLXVnfProtocolVersion => {
    switch (vnfProtocolVersion) {
        case '1.0':
            return VCLXVnfProtocolVersion.XVnfProtocolVersion1;
        case '2.0':
            return VCLXVnfProtocolVersion.XVnfProtocolVersion2;
        default:
            return VCLXVnfProtocolVersion.XVnfProtocolVersion1;
    }
};

export default VCLXVnfProtocolVersion;
