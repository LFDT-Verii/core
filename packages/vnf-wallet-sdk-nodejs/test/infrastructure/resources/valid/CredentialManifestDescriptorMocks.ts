/* eslint-disable max-len */
import VCLPushDelegate from '../../../../src/api/entities/VCLPushDelegate';
import { DeepLinkMocks } from './DeepLinkMocks';

class CredentialManifestDescriptorMocks {
    static DeepLink = DeepLinkMocks.CredentialManifestDeepLinkMainNet;

    static IssuerDid = DeepLinkMocks.IssuerDid;

    static DeepLinkRequestUri = DeepLinkMocks.CredentialManifestRequestUriStr;

    static CredentialTypesList = [
        'PastEmploymentPosition',
        'CurrentEmploymentPosition',
    ];

    static PushDelegate = new VCLPushDelegate(
        'https://devservices.velocitycareerlabs.io/api/push-gateway',
        'if0123asd129smw321'
    );

    static IssuingServiceEndPoint = `https://devagent.velocitycareerlabs.io/api/holder/v0.6/org/${this.IssuerDid}/issue/get-credential-manifest`;

    static IssuingServiceJsonStr = `{"id":"${this.IssuerDid}#credential-agent-issuer-1","type":"VelocityCredentialAgentIssuer_v1.0","credentialTypes":["Course","EducationDegree","Badge"],"serviceEndpoint":"${this.IssuingServiceEndPoint}"}`;

    static IssuingServiceWithParamEndPoint = `https://devagent.velocitycareerlabs.io/api/holder/v0.6/org/${this.IssuerDid}/issue/get-credential-manifest?key=value`;

    static IssuingServiceWithParamJsonStr = `{"id":"${this.IssuerDid}#credential-agent-issuer-1","type":"VelocityCredentialAgentIssuer_v1.0","credentialTypes":["Course","EducationDegree","Badge"],"serviceEndpoint":"${this.IssuingServiceWithParamEndPoint}"}`;

    static CredentialId1 =
        'did:velocity:v2:0x2bef092530ccc122f5fe439b78eddf6010685e88:248532930732481:1963';

    static CredentialId2 =
        'did:velocity:v2:0x2bef092530ccc122f5fe439b78eddf6010685e88:248532930732481:1963';
}

export { CredentialManifestDescriptorMocks };
