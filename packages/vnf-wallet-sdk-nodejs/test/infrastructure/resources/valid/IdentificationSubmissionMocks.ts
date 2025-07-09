/* eslint-disable max-len */

import VCLPushDelegate from '../../../../src/api/entities/VCLPushDelegate';
import {
    VCLCredentialManifest,
    VCLDeepLink,
    VCLDidJwk,
    VCLJwt,
    VCLToken,
    VCLVerifiableCredential,
    VCLVerifiedProfile,
} from '../../../../src';

export class IdentificationSubmissionMocks {
    static DidJwkJson = {
        did: 'did:jwk:eyJjcnYiOiJQLTI1NiIsImt0eSI6IkVDIiwieCI6IkFYQWxaWThqNGh5cm10dzBoRjNrLTJWT080THZXRzBLNEF5a0JYS25HVWciLCJ5IjoiYzlEVHE5cVRWUTlRQmlsLUgxdGRWN3FZZERic3BhTG5wZ0FJdkRKeEpHayJ9',
        kid: 'did:jwk:eyJjcnYiOiJQLTI1NiIsImt0eSI6IkVDIiwieCI6IkFYQWxaWThqNGh5cm10dzBoRjNrLTJWT080THZXRzBLNEF5a0JYS25HVWciLCJ5IjoiYzlEVHE5cVRWUTlRQmlsLUgxdGRWN3FZZERic3BhTG5wZ0FJdkRKeEpHayJ9#0',
        keyId: 'Iv5pwCQfp6e5FsncVgVX0',
        publicJwk: {
            kty: 'EC',
            crv: 'P-256',
            y: 'c9DTq9qTVQ9QBil-H1tdV7qYdDbspaLnpgAIvDJxJGk',
            x: 'AXAlZY8j4hyrmtw0hF3k-2VOO4LvWG0K4AykBXKnGUg',
        },
    };

    static DidJwk = VCLDidJwk.fromJSON(
        IdentificationSubmissionMocks.DidJwkJson
    );

    static PushDelegate = new VCLPushDelegate(
        'https://devservices.velocitycareerlabs.io/api/push-gateway',
        'if0123asd129smw321'
    );

    static VerifiableProfileJson = {
        id: '928363a2-bce4-4b54-9350-d0d906518da4',
        type: ['OrganizationBasicProfile-v1.0', 'VerifiableCredential'],
        issuer: {
            id: 'did:velocity:0x7c98a6cea317ec176ba865a42d3eae639dfe9fb1',
        },
        credentialSubject: {
            name: 'University of Massachusetts Amherst',
            location: { countryCode: 'US', regionCode: 'MA' },
            contactEmail: 'test@test.com',
            technicalEmail: 'test@test.com',
            description:
                'Test org, primarily for Issuing Education and Cource credentials',
            founded: '2023-04-04',
            type: 'company',
            physicalAddress: {
                line1: 'xxxx',
                line2: 'xxxx',
                line3: 'xxxx',
                regionCode: 'XX-XX',
                countryCode: 'XX',
                postcode: 'xxxx',
            },
            id: 'did:ion:EiApMLdMb4NPb8sae9-hXGHP79W1gisApVSE80USPEbtJA',
            permittedVelocityServiceCategory: ['Issuer', 'Inspector'],
            createdAt: '2022-03-01T10:17:38.542Z',
            updatedAt: '2023-06-26T13:36:05.180Z',
        },
        issued: '2024-02-13T11:54:41.000Z',
        credentialChecks: {
            checked: '2024-05-23T08:42:01.063Z',
            TRUSTED_ISSUER: 'PASS',
            UNREVOKED: 'NOT_CHECKED',
            UNEXPIRED: 'NOT_APPLICABLE',
            UNTAMPERED: 'PASS',
        },
    };

    static VerifiedProfile = new VCLVerifiedProfile(
        IdentificationSubmissionMocks.VerifiableProfileJson
    );

    static DeepLinkStr =
        'velocity-network-devnet://issue?request_uri=https%3A%2F%2Fdevagent.velocitycareerlabs.io%2Fapi%2Fholder%2Fv0.6%2Forg%2Fdid%3Aion%3AEiApMLdMb4NPb8sae9-hXGHP79W1gisApVSE80USPEbtJA%2Fissue%2Fget-credential-manifest%3Fid%3D6384a3ad148b1991687f67c9%26credential_types%3DEmploymentPastV1.1%26issuerDid%3Ddid%3Aion%3AEiApMLdMb4NPb8sae9-hXGHP79W1gisApVSE80USPEbtJA';

    static DeepLink = new VCLDeepLink(
        IdentificationSubmissionMocks.DeepLinkStr
    );

    static CredentialManifestJwtStr =
        'eyJ0eXAiOiJKV1QiLCJhbGciOiJFUzI1NksiLCJraWQiOiJkaWQ6aW9uOkVpQXBNTGRNYjROUGI4c2FlOS1oWEdIUDc5VzFnaXNBcFZTRTgwVVNQRWJ0SkEjZXhjaGFuZ2Uta2V5LTEifQ.eyJleGNoYW5nZV9pZCI6IjY2NGVmZjg5OTQ4MTMxMzQ2Y2EzYzc1NyIsIm1ldGFkYXRhIjp7ImNsaWVudF9uYW1lIjoiVW5pdmVyc2l0eSBvZiBNYXNzYWNodXNldHRzIEFtaGVyc3QiLCJsb2dvX3VyaSI6Imh0dHBzOi8vdXBsb2FkLndpa2ltZWRpYS5vcmcvd2lraXBlZGlhL2NvbW1vbnMvNC80Zi9VTWFzc19TZWFsX01lZGl1bV9QTVNfMjAyLnBuZyIsInRvc191cmkiOiJodHRwczovL3d3dy52ZWxvY2l0eWV4cGVyaWVuY2VjZW50ZXIuY29tL3Rlcm1zLWFuZC1jb25kaXRpb25zLXZuZiIsIm1heF9yZXRlbnRpb25fcGVyaW9kIjoiNm0iLCJwcm9ncmVzc191cmkiOiJodHRwczovL2RldmFnZW50LnZlbG9jaXR5Y2FyZWVybGFicy5pby9hcGkvaG9sZGVyL3YwLjYvb3JnL2RpZDppb246RWlBcE1MZE1iNE5QYjhzYWU5LWhYR0hQNzlXMWdpc0FwVlNFODBVU1BFYnRKQS9nZXQtZXhjaGFuZ2UtcHJvZ3Jlc3MiLCJzdWJtaXRfcHJlc2VudGF0aW9uX3VyaSI6Imh0dHBzOi8vZGV2YWdlbnQudmVsb2NpdHljYXJlZXJsYWJzLmlvL2FwaS9ob2xkZXIvdjAuNi9vcmcvZGlkOmlvbjpFaUFwTUxkTWI0TlBiOHNhZTktaFhHSFA3OVcxZ2lzQXBWU0U4MFVTUEVidEpBL2lzc3VlL3N1Ym1pdC1pZGVudGlmaWNhdGlvbiIsImNoZWNrX29mZmVyc191cmkiOiJodHRwczovL2RldmFnZW50LnZlbG9jaXR5Y2FyZWVybGFicy5pby9hcGkvaG9sZGVyL3YwLjYvb3JnL2RpZDppb246RWlBcE1MZE1iNE5QYjhzYWU5LWhYR0hQNzlXMWdpc0FwVlNFODBVU1BFYnRKQS9pc3N1ZS9jcmVkZW50aWFsLW9mZmVycyIsImZpbmFsaXplX29mZmVyc191cmkiOiJodHRwczovL2RldmFnZW50LnZlbG9jaXR5Y2FyZWVybGFicy5pby9hcGkvaG9sZGVyL3YwLjYvb3JnL2RpZDppb246RWlBcE1MZE1iNE5QYjhzYWU5LWhYR0hQNzlXMWdpc0FwVlNFODBVU1BFYnRKQS9pc3N1ZS9maW5hbGl6ZS1vZmZlcnMifSwicHJlc2VudGF0aW9uX2RlZmluaXRpb24iOnsiaWQiOiI2NjRlZmY4OTk0ODEzMTM0NmNhM2M3NTcuNjM4NGEzYWQxNDhiMTk5MTY4N2Y2N2M5IiwicHVycG9zZSI6IkNyZWRlbnRpYWxzIG9mZmVyIiwibmFtZSI6IlNoYXJlIHlvdXIgSWQsIEVtYWlsIGFuZCBQaG9uZSBOdW1iZXIgdG8gZmFjaWxpdGF0ZSB0aGUgc2VhcmNoIGZvciB5b3VyIGNhcmVlciBjcmVkZW50aWFscyIsImZvcm1hdCI6eyJqd3RfdnAiOnsiYWxnIjpbInNlY3AyNTZrMSJdfX0sImlucHV0X2Rlc2NyaXB0b3JzIjpbeyJpZCI6IkVtYWlsVjEuMCIsIm5hbWUiOiJFbWFpbCIsInNjaGVtYSI6W3sidXJpIjoiaHR0cHM6Ly9kZXZsaWIudmVsb2NpdHluZXR3b3JrLmZvdW5kYXRpb24vc2NoZW1hcy9lbWFpbC12MS4wLnNjaGVtYS5qc29uIn1dLCJncm91cCI6WyJBIl19XSwic3VibWlzc2lvbl9yZXF1aXJlbWVudHMiOlt7InJ1bGUiOiJhbGwiLCJmcm9tIjoiQSIsIm1pbiI6MX1dfSwib3V0cHV0X2Rlc2NyaXB0b3JzIjpbeyJpZCI6IkVtcGxveW1lbnRQYXN0VjEuMSIsIm5hbWUiOiJQYXN0IGVtcGxveW1lbnQgcG9zaXRpb24iLCJzY2hlbWEiOlt7InVyaSI6Imh0dHBzOi8vZGV2bGliLnZlbG9jaXR5bmV0d29yay5mb3VuZGF0aW9uL3NjaGVtYXMvZW1wbG95bWVudC1wYXN0LXYxLjEuc2NoZW1hLmpzb24ifV0sImRpc3BsYXkiOnsidGl0bGUiOnsicGF0aCI6WyIkLmxlZ2FsRW1wbG95ZXIubmFtZSJdLCJzY2hlbWEiOnsidHlwZSI6InN0cmluZyJ9LCJmYWxsYmFjayI6Ii0ifSwic3VidGl0bGUiOnsicGF0aCI6WyIkLnJvbGUiXSwic2NoZW1hIjp7InR5cGUiOiJzdHJpbmcifSwiZmFsbGJhY2siOiItIn0sInN1bW1hcnlfZGV0YWlsIjp7InBhdGgiOlsiJC5wbGFjZS5uYW1lIl0sInNjaGVtYSI6eyJ0eXBlIjoic3RyaW5nIn0sImZhbGxiYWNrIjoicGxhY2UuYWRkcmVzc0xvY2FsaXR5In0sImRlc2NyaXB0aW9uIjp7InRleHQiOiJQYXN0IGVtcGxveW1lbnQgcG9zaXRpb24ifSwibG9nbyI6eyJwYXRoIjpbIiQubGVnYWxFbXBsb3llci5pbWFnZSJdLCJzY2hlbWEiOnsidHlwZSI6InN0cmluZyIsImZvcm1hdCI6InVyaSJ9fSwicHJvcGVydGllcyI6W3sibGFiZWwiOiJSb2xlIiwicGF0aCI6WyIkLnJvbGUiXSwic2NoZW1hIjp7InR5cGUiOiJzdHJpbmcifX0seyJsYWJlbCI6IlJvbGUgZGVzY3JpcHRpb24iLCJwYXRoIjpbIiQuZGVzY3JpcHRpb24iXSwic2NoZW1hIjp7InR5cGUiOiJzdHJpbmcifX0seyJsYWJlbCI6IlN0YXJ0IGRhdGUiLCJwYXRoIjpbIiQuc3RhcnREYXRlIl0sInNjaGVtYSI6eyJ0eXBlIjoic3RyaW5nIiwiZm9ybWF0IjoiZGF0ZSJ9fSx7ImxhYmVsIjoiRW5kIGRhdGUiLCJwYXRoIjpbIiQuZW5kRGF0ZSJdLCJzY2hlbWEiOnsidHlwZSI6InN0cmluZyIsImZvcm1hdCI6ImRhdGUifX0seyJsYWJlbCI6IlBsYWNlIG9mIHdvcmsiLCJwYXRoIjpbIiQucGxhY2UubmFtZSJdLCJzY2hlbWEiOnsidHlwZSI6InN0cmluZyJ9fSx7ImxhYmVsIjoiQ2l0eSBvZiB3b3JrIiwicGF0aCI6WyIkLnBsYWNlLmFkZHJlc3NMb2NhbGl0eSJdLCJzY2hlbWEiOnsidHlwZSI6InN0cmluZyJ9fSx7ImxhYmVsIjoiU3RhdGUgb3IgcmVnaW9uIG9mIHdvcmsiLCJwYXRoIjpbIiQucGxhY2UuYWRkcmVzc1JlZ2lvbiJdLCJzY2hlbWEiOnsidHlwZSI6InN0cmluZyJ9fSx7ImxhYmVsIjoiQ291bnRyeSBvZiB3b3JrIiwicGF0aCI6WyIkLnBsYWNlLmFkZHJlc3NDb3VudHJ5Il0sInNjaGVtYSI6eyJ0eXBlIjoic3RyaW5nIn19LHsibGFiZWwiOiJFbXBsb3ltZW50IHR5cGUiLCJwYXRoIjpbIiQuZW1wbG95bWVudFR5cGVbKl0iXSwic2NoZW1hIjp7InR5cGUiOiJzdHJpbmcifX0seyJsYWJlbCI6IkZpcnN0IG5hbWUiLCJwYXRoIjpbIiQucmVjaXBpZW50LmdpdmVuTmFtZSJdLCJzY2hlbWEiOnsidHlwZSI6InN0cmluZyJ9fSx7ImxhYmVsIjoiTWlkZGxlIG5hbWUiLCJwYXRoIjpbIiQucmVjaXBpZW50Lm1pZGRsZU5hbWUiXSwic2NoZW1hIjp7InR5cGUiOiJzdHJpbmcifX0seyJsYWJlbCI6Ikxhc3QgbmFtZSIsInBhdGgiOlsiJC5yZWNpcGllbnQuZmFtaWx5TmFtZSJdLCJzY2hlbWEiOnsidHlwZSI6InN0cmluZyJ9fSx7ImxhYmVsIjoiTmFtZSBwcmVmaXgiLCJwYXRoIjpbIiQucmVjaXBpZW50Lm5hbWVQcmVmaXgiXSwic2NoZW1hIjp7InR5cGUiOiJzdHJpbmcifX0seyJsYWJlbCI6Ik5hbWUgc3VmZml4IiwicGF0aCI6WyIkLnJlY2lwaWVudC5uYW1lU3VmZml4Il0sInNjaGVtYSI6eyJ0eXBlIjoic3RyaW5nIn19LHsibGFiZWwiOiJMZWFybiBtb3JlIGFib3V0IHRoZSBjcmVkZW50aWFsIiwicGF0aCI6WyIkLmFsaWdubWVudFswXS50YXJnZXRVcmwiXSwic2NoZW1hIjp7InR5cGUiOiJzdHJpbmciLCJmb3JtYXQiOiJ1cmkifX1dfX1dLCJpc3N1ZXIiOnsiaWQiOiJkaWQ6aW9uOkVpQXBNTGRNYjROUGI4c2FlOS1oWEdIUDc5VzFnaXNBcFZTRTgwVVNQRWJ0SkEifSwibmJmIjoxNzE2NDUzMjU5LCJpc3MiOiJkaWQ6aW9uOkVpQXBNTGRNYjROUGI4c2FlOS1oWEdIUDc5VzFnaXNBcFZTRTgwVVNQRWJ0SkEiLCJleHAiOjE3MTcwNTgwNTksImlhdCI6MTcxNjQ1MzI1OX0';

    static CredentialManifestJwt = VCLJwt.fromEncodedJwt(
        IdentificationSubmissionMocks.CredentialManifestJwtStr
    );

    static RemoteCryptoServicesTokenStr =
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';

    static RemoteCryptoServicesToken = new VCLToken(
        IdentificationSubmissionMocks.RemoteCryptoServicesTokenStr
    );

    static CredentialManifest = new VCLCredentialManifest(
        IdentificationSubmissionMocks.CredentialManifestJwt,
        null,
        IdentificationSubmissionMocks.VerifiedProfile,
        IdentificationSubmissionMocks.DeepLink,
        IdentificationSubmissionMocks.DidJwk,
        IdentificationSubmissionMocks.RemoteCryptoServicesToken
    );

    static AdamSmithDriversLicenseJwt =
        'eyJ0eXAiOiJKV1QiLCJraWQiOiJkaWQ6dmVsb2NpdHk6djI6MHg2MjU2YjE4OTIxZWFiZDM5MzUxZWMyM2YxYzk0Zjg4MDYwNGU3MGU3OjIxMTQ4ODcxODM1NTAwODo2NzYyI2tleS0xIiwiYWxnIjoiRVMyNTZLIn0.eyJ2YyI6eyJAY29udGV4dCI6WyJodHRwczovL3d3dy53My5vcmcvMjAxOC9jcmVkZW50aWFscy92MSJdLCJ0eXBlIjpbIkRyaXZlcnNMaWNlbnNlVjEuMCIsIlZlcmlmaWFibGVDcmVkZW50aWFsIl0sImNyZWRlbnRpYWxTdGF0dXMiOnsidHlwZSI6IlZlbG9jaXR5UmV2b2NhdGlvbkxpc3RKYW4yMDIxIiwiaWQiOiJldGhlcmV1bToweEQ4OTBGMkQ2MEI0MjlmOWUyNTdGQzBCYzU4RWYyMjM3Nzc2REQ5MUIvZ2V0UmV2b2tlZFN0YXR1cz9hZGRyZXNzPTB4MDMwMThFM2EzODk3MzRhRTEyZjE0RTQ0NTQwZkFlYTM1NzkxZkVDNyZsaXN0SWQ9MTYzNTc4ODY2Mjk2NjUzJmluZGV4PTIxMDMiLCJzdGF0dXNMaXN0SW5kZXgiOjIxMDMsInN0YXR1c0xpc3RDcmVkZW50aWFsIjoiZXRoZXJldW06MHhEODkwRjJENjBCNDI5ZjllMjU3RkMwQmM1OEVmMjIzNzc3NkREOTFCL2dldFJldm9rZWRTdGF0dXM_YWRkcmVzcz0weDAzMDE4RTNhMzg5NzM0YUUxMmYxNEU0NDU0MGZBZWEzNTc5MWZFQzcmbGlzdElkPTE2MzU3ODg2NjI5NjY1MyIsImxpbmtDb2RlQ29tbWl0IjoiRWlBSVkxWHdaZzV4cnZvUk5jNE55d3JBcVhrV2pZU05MVTM2dDlQQ0dzbDQ5dz09In0sImNvbnRlbnRIYXNoIjp7InR5cGUiOiJWZWxvY2l0eUNvbnRlbnRIYXNoMjAyMCIsInZhbHVlIjoiZTkwN2Y1NDc2YzU3ZTczNDIzZjFjOWIzOTNiYzFkMGE0ZDU2MjgwYWMxNTUzOTZjYzg3OWYyNDQxYTUyM2NkYyJ9LCJjcmVkZW50aWFsU2NoZW1hIjp7ImlkIjoiaHR0cHM6Ly9kZXZyZWdpc3RyYXIudmVsb2NpdHluZXR3b3JrLmZvdW5kYXRpb24vc2NoZW1hcy9kcml2ZXJzLWxpY2Vuc2UtdjEuMC5zY2hlbWEuanNvbiIsInR5cGUiOiJKc29uU2NoZW1hVmFsaWRhdG9yMjAxOCJ9LCJjcmVkZW50aWFsU3ViamVjdCI6eyJuYW1lOiI6IkNhbGlmb3JuaWEgRHJpdmVyIExpY2Vuc2UiLCJhdXRob3JpdHkiOnsibmFtZSI6IkNhbGlmb3JuaWEgRE1WIiwicGxhY2UiOnsiYWRkcmVzc1JlZ2lvbiI6IkNBIiwiYWRkcmVzc0NvdW50cnkiOiJVUyJ9fSwidmFsaWRpdHkiOnsidmFsaWRGcm9tIjoiMjAxNS0wMi0wMSIsInZhbGlkVW50aWwiOiIyMDI1LTAxLTMwIn0sImlkZW50aWZpZXIiOiIxMjMxMDMxMjMxMiIsInBlcnNvbiI6eyJnaXZlbk5hbWUiOiJBZGFtIiwiZmFtaWx5TmFtZSI6IlNtaXRoIiwiYmlydGhEYXRlIjoiMTk2Ni0wNi0yMCIsImdlbmRlciI6Ik1hbGUifX19LCJpc3MiOiJkaWQ6aW9uOkVpQWVoV21wWDVtSEJ1YzkzU0loUFhGOGJzRXg2OEc2bVBjZElhTE5HYm96UEEiLCJqdGkiOiJkaWQ6dmVsb2NpdHk6djI6MHg2MjU2YjE4OTIxZWFiZDM5MzUxZWMyM2YxYzk0Zjg4MDYwNGU3MGU3OjIxMTQ4ODcxODM1NTAwODo2NzYyIiwiaWF0IjoxNjUyODk2ODY5LCJuYmYiOjE2NTI4OTY4Njl9.DYSJseMcm31Odj7tncT_HBRMs5mknBBRgWuAranmKuY1MPQoBG-A0qOOI9Q3z8X78B7sJISE5iAXBkaVKjUJ2w';

    static AdamSmithPhoneJwt =
        'eyJ0eXAiOiJKV1QiLCJqd2siOnsiY3J2Ijoic2VjcDI1NmsxIiwieCI6IjFtNi1ZSWtHZTA3MmxYcUNqd1RCTExhMnN6bTZ1cGtMTTNjZnY4eVF6ZEEiLCJ5IjoiNDVBWkJlU2xVOUlSSUR5MHA5RF9kaFR4MkZ4dGQtMlBGdkVma3dsZnRGZyIsImt0eSI6IkVDIiwia2lkIjoiZnV0c2VQQUNRdFVJWnRNVlRMR1RYZzFXMGlUZG1odXJBVHZpcmxES3BwZyIsImFsZyI6IkVTMjU2SyIsInVzZSI6InNpZyJ9LCJhbGciOiJFUzI1NksifQ.eyJ2YyI6eyJAY29udGV4dCI6WyJodHRwczovL3d3dy53My5vcmcvMjAxOC9jcmVkZW50aWFscy92MSJdLCJ0eXBlIjpbIlBob25lVjEuMCIsIlZlcmlmaWFibGVDcmVkZW50aWFsIl0sImNyZWRlbnRpYWxTdWJqZWN0Ijp7InBob25lIjoiKzE1NTU2MTkyMTkxIn19LCJpc3MiOiJkaWQ6dmVsb2NpdHk6MHhiYTdkODdmOWQ1ZTQ3M2Q3ZDNhODJkMTUyOTIzYWRiNTNkZThmYzBlIiwianRpIjoiZGlkOnZlbG9jaXR5OjB4OGNlMzk4Y2VmNGY3ZWQ4ZWI1MGEyOGQyNWM4NjNlZWY5NjhiYjBlZSIsImlhdCI6MTYzNDUxMDg5NCwibmJmIjoxNjM0NTEwODk0fQ.g3YivH_Quiw95TywvTmiv2CBWsp5JrrCcbpOcTtYpMAQNQJD7Q3kmMYTBs1Zg3tKFRPSJ_XozFIXug5nsn2SGg';

    static AdamSmithEmailJwt =
        'eyJ0eXAiOiJKV1QiLCJraWQiOiJkaWQ6dmVsb2NpdHk6djI6MHg2MjU2YjE4OTIxZWFiZDM5MzUxZWMyM2YxYzk0Zjg4MDYwNGU3MGU3OjIxMTQ4ODcxODM1NTAwODo0MTY2I2tleS0xIiwiYWxnIjoiRVMyNTZLIn0.eyJ2YyI6eyJAY29udGV4dCI6WyJodHRwczovL3d3dy53My5vcmcvMjAxOC9jcmVkZW50aWFscy92MSJdLCJ0eXBlIjpbIkVtYWlsVjEuMCIsIlZlcmlmaWFibGVDcmVkZW50aWFsIl0sImNyZWRlbnRpYWxTdGF0dXMiOnsidHlwZSI6IlZlbG9jaXR5UmV2b2NhdGlvbkxpc3RKYW4yMDIxIiwiaWQiOiJldGhlcmV1bToweEQ4OTBGMkQ2MEI0MjlmOWUyNTdGQzBCYzU4RWYyMjM3Nzc2REQ5MUIvZ2V0UmV2b2tlZFN0YXR1cz9hZGRyZXNzPTB4MDMwMThFM2EzODk3MzRhRTEyZjE0RTQ0NTQwZkFlYTM1NzkxZkVDNyZsaXN0SWQ9MTYzNTc4ODY2Mjk2NjUzJmluZGV4PTg2OTgiLCJzdGF0dXNMaXN0SW5kZXgiOjg2OTgsInN0YXR1c0xpc3RDcmVkZW50aWFsIjoiZXRoZXJldW06MHhEODkwRjJENjBCNDI5ZjllMjU3RkMwQmM1OEVmMjIzNzc3NkREOTFCL2dldFJldm9rZWRTdGF0dXM_YWRkcmVzcz0weDAzMDE4RTNhMzg5NzM0YUUxMmYxNEU0NDU0MGZBZWEzNTc5MWZFQzcmbGlzdElkPTE2MzU3ODg2NjI5NjY1MyIsImxpbmtDb2RlQ29tbWl0IjoiRWlBb3FJWWYycmgxdzEvdURXTnNwYTRyOHRrV2dwRGRUUjBtNHlIRTVMZUtQZz09In0sImNvbnRlbnRIYXNoIjp7InR5cGUiOiJWZWxvY2l0eUNvbnRlbnRIYXNoMjAyMCIsInZhbHVlIjoiODlkNGRjYzg2ZDU0MGM2ZWVhMzlkMTc4ZWVkYzMwMjEzZTc4MmYyNTFlMDNiNzZmNDI3MzEwNjgwOGRkMGQ0ZiJ9LCJjcmVkZW50aWFsU2NoZW1hIjp7ImlkIjoiaHR0cHM6Ly9kZXZyZWdpc3RyYXIudmVsb2NpdHluZXR3b3JrLmZvdW5kYXRpb24vc2NoZW1hcy9lbWFpbC12MS4wLnNjaGVtYS5qc29uIiwidHlwZSI6Ikpzb25TY2hlbWFWYWxpZGF0b3IyMDE4In0sImNyZWRlbnRpYWxTdWJqZWN0Ijp7ImVtYWlsIjoiYWRhbS5zbWl0aEBleGFtcGxlLmNvbSJ9fSwiaXNzIjoiZGlkOmlvbjpFaUFlaFdtcFg1bUhCdWM5M1NJaFBYRjhic0V4NjhHNm1QY2RJYUxOR2JvelBBIiwianRpIjoiZGlkOnZlbG9jaXR5OnYyOjB4NjI1NmIxODkyMWVhYmQzOTM1MWVjMjNmMWM5NGY4ODA2MDRlNzBlNzoyMTE0ODg3MTgzNTUwMDg6NDE2NiIsImlhdCI6MTY1Mjg5Njg2OSwibmJmIjoxNjUyODk2ODY5fQ.fi0qJFzHiDEWTGUu0ME1aG36-j2jm7xxA2DWPs_Ra7ftl-ALMu0FY3A38klbkJQYCaXWHFH0hBbcQ5Z3uZCeew';

    static IdentificationList = [
        new VCLVerifiableCredential(
            'PhoneV1.0',
            IdentificationSubmissionMocks.AdamSmithPhoneJwt
        ),
        new VCLVerifiableCredential(
            'EmailV1.0',
            IdentificationSubmissionMocks.AdamSmithEmailJwt
        ),
        new VCLVerifiableCredential(
            'DriversLicenseV1.0',
            IdentificationSubmissionMocks.AdamSmithDriversLicenseJwt
        ),
    ];
}
