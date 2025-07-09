/* eslint-disable max-len */

import VCLPresentationRequest from '../../../../src/api/entities/VCLPresentationRequest';
import VCLPushDelegate from '../../../../src/api/entities/VCLPushDelegate';
import { DeepLinkMocks } from './DeepLinkMocks';
import { JwtMocks } from './JwtMocks';
import VCLVerifiableCredential from '../../../../src/api/entities/VCLVerifiableCredential';
import VCLVerifiedProfile from '../../../../src/api/entities/VCLVerifiedProfile';
import { DidJwkMocks } from './DidJwkMocks';

class PresentationSubmissionMocks {
    static PushDelegate = new VCLPushDelegate(
        'https://devservices.velocitycareerlabs.io/api/push-gateway',
        'if0123asd129smw321'
    );

    static PresentationSubmissionResultStr =
        '{"token":"u7yLD8KS2eTEqkg9aRQE","exchange":{"id":"64131231","type":"DISCLOSURE","disclosureComplete":true,"exchangeComplete":true}}';

    static PresentationSubmissionResultJson = {
        token: 'u7yLD8KS2eTEqkg9aRQE',
        exchange: {
            id: '64131231',
            type: 'DISCLOSURE',
            disclosureComplete: true,
            exchangeComplete: true,
        },
    };

    static PresentationRequest = new VCLPresentationRequest(
        JwtMocks.JWT,
        new VCLVerifiedProfile({}),
        DeepLinkMocks.CredentialManifestDeepLinkMainNet,
        this.PushDelegate,
        DidJwkMocks.DidJwk
    );

    static SelectionsList = [
        new VCLVerifiableCredential(
            'IdDocument',
            JwtMocks.AdamSmithIdDocumentJwt
        ),
        new VCLVerifiableCredential('Email', JwtMocks.AdamSmithEmailJwt),
    ];

    static JwtEncodedSubmission =
        'eyJraWQiOiJkaWQ6andrOmV5SnJkSGtpT2lKRlF5SXNJblZ6WlNJNkluTnBaeUlzSW1OeWRpSTZJbEF0TWpVMklpd2lhMmxrSWpvaU5qRXhZVGs1TmprdFlqWmpNeTAwWXpJeExXSTFZell0T0dRd01qa3dZMlkwTlRabElpd2llQ0k2SWtacVVsOHhVelZ2WVRkblIydElSRlJsYkhKVGIydHJjMjF0ZEZSa1VFNXRkbTFUVWtSc1FtZHBXVlVpTENKNUlqb2lTRWs0T0hOTFZ6UndlbmxWU0ZSMFFsaGtPR3RQYVZwemVGZGhUSGhxUkVWZlEwdEhWR05GVkRCUU1DSjkjMCIsInR5cCI6IkpXVCIsImFsZyI6IkVTMjU2IiwiandrIjp7Imt0eSI6IkVDIiwidXNlIjoic2lnIiwiY3J2IjoiUC0yNTYiLCJraWQiOiI2MTFhOTk2OS1iNmMzLTRjMjEtYjVjNi04ZDAyOTBjZjQ1NmUiLCJ4IjoiRmpSXzFTNW9hN2dHa0hEVGVsclNva2tzbW10VGRQTm12bVNSRGxCZ2lZVSIsInkiOiJISTg4c0tXNHB6eVVIVHRCWGQ4a09pWnN4V2FMeGpERV9DS0dUY0VUMFAwIn19.eyJzdWIiOiJlSWZXUmhqSkNMIiwibmJmIjoxNzE2NDUwMDExLCJpc3MiOiJkaWQ6andrOmV5SnJkSGtpT2lKRlF5SXNJblZ6WlNJNkluTnBaeUlzSW1OeWRpSTZJbEF0TWpVMklpd2lhMmxrSWpvaU5qRXhZVGs1TmprdFlqWmpNeTAwWXpJeExXSTFZell0T0dRd01qa3dZMlkwTlRabElpd2llQ0k2SWtacVVsOHhVelZ2WVRkblIydElSRlJsYkhKVGIydHJjMjF0ZEZSa1VFNXRkbTFUVWtSc1FtZHBXVlVpTENKNUlqb2lTRWs0T0hOTFZ6UndlbmxWU0ZSMFFsaGtPR3RQYVZwemVGZGhUSGhxUkVWZlEwdEhWR05GVkRCUU1DSjkiLCJ2cCI6eyJ0eXBlIjoiVmVyaWZpYWJsZVByZXNlbnRhdGlvbiIsInByZXNlbnRhdGlvbl9zdWJtaXNzaW9uIjp7ImlkIjoiN2U0NjM3MzktZGRlMC00OTU2LWFlNTYtMjk4MDQ5YmY3MzVlIiwiZGVmaW5pdGlvbl9pZCI6IiIsImRlc2NyaXB0b3JfbWFwIjpbXX0sInZlcmlmaWFibGVDcmVkZW50aWFsIjpbXX0sImV4cCI6MTcxNzA1NDgxMSwiaWF0IjoxNzE2NDUwMDExLCJqdGkiOiIxOTllOWRiMC1mNDg5LTQ1MjAtOGYyNy1hYjM4N2NjMzQ4MWQifQ';
}

export { PresentationSubmissionMocks };
