/* eslint-disable max-len */

import { VCLDeepLink } from '../../../../src';

export class DeepLinkMocks {
    static DevNetProtocol = 'velocity-network-devnet';

    static TestNetProtocol = 'velocity-network-testnet';

    static MainNetProtocol = 'velocity-network';

    static OIDIssuerDid =
        'did:velocity:0xc257274276a4e539741ca11b590b9447b26a8051';

    static Issuer =
        'https%3A%2F%2Fdevagent.velocitycareerlabs.io%2Fapi%2Fholder%2Fv0.6%2Forg%2Fdid%3Avelocity%3A0xc257274276a4e539741ca11b590b9447b26a8051%2Foidc%26credential_type%3DPastEmploymentPosition%26pre-authorized_code%3D8L1UArquTYvE-ylC2BV_2%26issuerDid%3Ddid%3Avelocity%3A0xc257274276a4e539741ca11b590b9447b26a8051';

    static OpenidInitiateIssuanceStrDev = `openid-initiate-issuance://?issuer=${DeepLinkMocks.Issuer}`;

    static InspectorDid =
        'did:velocity:0xd4df29726d500f9b85bc6c7f1b3c021f16305692';

    static InspectorId = '987934576974554';

    static PresentationRequestVendorOriginContext =
        '{"SubjectKey":{"BusinessUnit":"ZC","KeyCode":"54514480"},"Token":"832077a4"}';

    static PresentationRequestRequestDecodedUriStr = decodeURIComponent(
        `https://agent.velocitycareerlabs.io/api/holder/v0.6/org/${DeepLinkMocks.InspectorDid}/inspect/get-presentation-request?id=62e0e80c5ebfe73230b0becc&inspectorDid=${DeepLinkMocks.InspectorDid}&vendorOriginContext=%7B%22SubjectKey%22%3A%7B%22BusinessUnit%22%3A%22ZC%22,%22KeyCode%22%3A%2254514480%22%7D,%22Token%22%3A%22832077a4%22%7D`
    );

    static PresentationRequestRequestDecodedUriWithIdStr = decodeURIComponent(
        `https://agent.velocitycareerlabs.io/api/holder/v0.6/org/${DeepLinkMocks.InspectorId}/inspect/get-presentation-request?id=62e0e80c5ebfe73230b0becc&inspectorDid=${DeepLinkMocks.InspectorDid}&vendorOriginContext=%7B%22SubjectKey%22%3A%7B%22BusinessUnit%22%3A%22ZC%22,%22KeyCode%22%3A%2254514480%22%7D,%22Token%22%3A%22832077a4%22%7D`
    );

    static PresentationRequestRequestUriStr =
        'https%3A%2F%2Fagent.velocitycareerlabs.io%2Fapi%2Fholder%2Fv0.6%2Forg%2Fdid%3Avelocity%3A0xd4df29726d500f9b85bc6c7f1b3c021f16305692%2Finspect%2Fget-presentation-request%3Fid%3D62e0e80c5ebfe73230b0becc%26inspectorDid%3Ddid%3Avelocity%3A0xd4df29726d500f9b85bc6c7f1b3c021f16305692%26vendorOriginContext%3D%7B%22SubjectKey%22%3A%7B%22BusinessUnit%22%3A%22ZC%22%2C%22KeyCode%22%3A%2254514480%22%7D%2C%22Token%22%3A%22832077a4%22%7D';

    static PresentationRequestRequestUriWithIdStr = `https%3A%2F%2Fagent.velocitycareerlabs.io%2Fapi%2Fholder%2Fv0.6%2Forg%2F${DeepLinkMocks.InspectorId}%2Finspect%2Fget-presentation-request%3Fid%3D62e0e80c5ebfe73230b0becc%26inspectorDid%3Ddid%3Avelocity%3A0xd4df29726d500f9b85bc6c7f1b3c021f16305692%26vendorOriginContext%3D%7B%22SubjectKey%22%3A%7B%22BusinessUnit%22%3A%22ZC%22%2C%22KeyCode%22%3A%2254514480%22%7D%2C%22Token%22%3A%22832077a4%22%7D`;

    static PresentationRequestDeepLinkDevNetStr = `${DeepLinkMocks.DevNetProtocol}://inspect?request_uri=${DeepLinkMocks.PresentationRequestRequestUriStr}`;

    static PresentationRequestDeepLinkTestNetStr = `${DeepLinkMocks.TestNetProtocol}://inspect?request_uri=${DeepLinkMocks.PresentationRequestRequestUriStr}`;

    static PresentationRequestDeepLinkMainNetStr = `${DeepLinkMocks.MainNetProtocol}://inspect?request_uri=${DeepLinkMocks.PresentationRequestRequestUriStr}`;

    static PresentationRequestDeepLinkMainNetWithIdStr = `${DeepLinkMocks.MainNetProtocol}://inspect?request_uri=${DeepLinkMocks.PresentationRequestRequestUriWithIdStr}`;

    static IssuerDid = 'did:ion:EiApMLdMb4NPb8sae9-hXGHP79W1gisApVSE80USPEbtJA';

    static IssuerId = '843794687t394524';

    static CredentialManifestRequestDecodedUriStr = `https://devagent.velocitycareerlabs.io/api/holder/v0.6/org/${DeepLinkMocks.IssuerDid}/issue/get-credential-manifest?id=611b5836e93d08000af6f1bc&credential_types=PastEmploymentPosition&issuerDid=${DeepLinkMocks.IssuerDid}`;

    static CredentialManifestRequestDecodedUriWithIdStr = `https://devagent.velocitycareerlabs.io/api/holder/v0.6/org/${DeepLinkMocks.IssuerId}/issue/get-credential-manifest?id=611b5836e93d08000af6f1bc&credential_types=PastEmploymentPosition&issuerDid=${DeepLinkMocks.IssuerDid}`;

    static CredentialManifestRequestUriStr =
        'https%3A%2F%2Fdevagent.velocitycareerlabs.io%2Fapi%2Fholder%2Fv0.6%2Forg%2Fdid%3Aion%3AEiApMLdMb4NPb8sae9-hXGHP79W1gisApVSE80USPEbtJA%2Fissue%2Fget-credential-manifest%3Fid%3D611b5836e93d08000af6f1bc%26credential_types%3DPastEmploymentPosition%26issuerDid%3Ddid%3Aion%3AEiApMLdMb4NPb8sae9-hXGHP79W1gisApVSE80USPEbtJA';

    static CredentialManifestRequestUriWithIdStr = `https%3A%2F%2Fdevagent.velocitycareerlabs.io%2Fapi%2Fholder%2Fv0.6%2Forg%2F${DeepLinkMocks.IssuerId}%2Fissue%2Fget-credential-manifest%3Fid%3D611b5836e93d08000af6f1bc%26credential_types%3DPastEmploymentPosition%26issuerDid%3Ddid%3Aion%3AEiApMLdMb4NPb8sae9-hXGHP79W1gisApVSE80USPEbtJA`;

    static CredentialManifestDeepLinkDevNetStr = `${DeepLinkMocks.DevNetProtocol}://issue?request_uri=${DeepLinkMocks.CredentialManifestRequestUriStr}`;

    static CredentialManifestDeepLinkTestNetStr = `${DeepLinkMocks.TestNetProtocol}://issue?request_uri=${DeepLinkMocks.CredentialManifestRequestUriStr}`;

    static CredentialManifestDeepLinkMainNetStr = `${DeepLinkMocks.MainNetProtocol}://issue?request_uri=${DeepLinkMocks.CredentialManifestRequestUriStr}`;

    static CredentialManifestDeepLinkDevNet = new VCLDeepLink(
        DeepLinkMocks.CredentialManifestDeepLinkDevNetStr
    );

    static CredentialManifestDeepLinkMainNetWithIdStr = `${DeepLinkMocks.MainNetProtocol}://issue?request_uri=${DeepLinkMocks.CredentialManifestRequestUriWithIdStr}`;

    static CredentialManifestDeepLinkTestNet = new VCLDeepLink(
        DeepLinkMocks.CredentialManifestDeepLinkTestNetStr
    );

    static CredentialManifestDeepLinkMainNet = new VCLDeepLink(
        DeepLinkMocks.CredentialManifestDeepLinkMainNetStr
    );

    static CredentialManifestDeepLinkMainNetWithId = new VCLDeepLink(
        DeepLinkMocks.CredentialManifestDeepLinkMainNetWithIdStr
    );

    static PresentationRequestDeepLinkDevNet = new VCLDeepLink(
        DeepLinkMocks.PresentationRequestDeepLinkDevNetStr
    );

    static PresentationRequestDeepLinkMainNetWithId = new VCLDeepLink(
        DeepLinkMocks.PresentationRequestDeepLinkMainNetWithIdStr
    );
}
