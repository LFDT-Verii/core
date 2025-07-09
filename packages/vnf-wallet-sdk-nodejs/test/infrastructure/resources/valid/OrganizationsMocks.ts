/* eslint-disable max-len */

export class OrganizationsMocks {
    static readonly OrganizationJsonStr = {
        id: 'did:velocity:0x571cf9ef33b111b7060942eb43133c0b347c7ca3',
        name: 'Universidad de Sant Cugat',
        logo: 'https://docs.velocitycareerlabs.io/Logos/Universidad de Sant Cugat.png',
        location: {
            countryCode: 'ES',
            regionCode: 'CAT',
        },
        founded: '1984',
        website: 'https://example.com',
        permittedVelocityServiceCategories: ['Issuer', null],
        service: [
            {
                id: 'did:velocity:0x571cf9ef33b111b7060942eb43133c0b347c7ca3#credential-agent-issuer-1',
                type: 'VelocityCredentialAgentIssuer_v1.0',
                credentialTypes: ['Course', 'EducationDegree', 'Badge'],
                serviceEndpoint:
                    'https://devagent.velocitycareerlabs.io/api/holder/v0.6/org/did:velocity:0x571cf9ef33b111b7060942eb43133c0b347c7ca3/issue/get-credential-manifest',
            },
        ],
    };

    static readonly OrganizationJsonResultStr = {
        result: [OrganizationsMocks.OrganizationJsonStr],
    };

    static readonly ServiceJson = {
        id: 'did:velocity:0x571cf9ef33b111b7060942eb43133c0b347c7ca3#credential-agent-issuer-1',
        type: 'VelocityCredentialAgentIssuer_v1.0',
        credentialTypes: ['Course', 'EducationDegree', 'Badge'],
        serviceEndpoint:
            'https://devagent.velocitycareerlabs.io/api/holder/v0.6/org/did:velocity:0x571cf9ef33b111b7060942eb43133c0b347c7ca3/issue/get-credential-manifest',
    };

    static readonly ServiceEndpoint: string =
        'https://devagent.velocitycareerlabs.io/api/holder/v0.6/org/did:velocity:0x571cf9ef33b111b7060942eb43133c0b347c7ca3/issue/get-credential-manifest';
}
