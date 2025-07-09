import VCLDeepLink from '../../../../src/api/entities/VCLDeepLink';
import VCLPushDelegate from '../../../../src/api/entities/VCLPushDelegate';
/* eslint-disable max-len */

class PresentationRequestDescriptorMocks {
    static InspectorDid =
        'did:velocity:0xd4df29726d500f9b85bc6c7f1b3c021f16305692';

    static RequestUri =
        'https%3A%2F%2Fdevagent.velocitycareerlabs.io%2Fapi%2Fholder%2Fv0.6%2Forg%2Fdid%3Avelocity%3A0xd4df29726d500f9b85bc6c7f1b3c021f16305692%2Finspect%2Fget-presentation-request';

    static DeepLink = new VCLDeepLink(
        `velocity-network-devnet://inspect?request_uri=${this.RequestUri}`
    );

    static QParms = `id=61efe084b2658481a3d9248c&inspectorDid=${encodeURIComponent(
        this.InspectorDid
    )}&vendorOriginContext=%7B%22SubjectKey%22%3A%7B%22BusinessUnit%22%3A%22ZC%22%22KeyCode%22%3A%2254514480%22%7D%22Token%22%3A%22832077a4%22%7D`;

    static RequestUriWithQParams = `${this.RequestUri}?${this.QParms}`;

    static DeepLinkWithQParams = new VCLDeepLink(
        `velocity-network-devnet://inspect?request_uri=${this.RequestUriWithQParams}`
    );

    static PushDelegate = new VCLPushDelegate(
        'https://devservices.velocitycareerlabs.io/api/push-gateway',
        'if0123asd129smw321'
    );
}

export { PresentationRequestDescriptorMocks };
