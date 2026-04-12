import { beforeEach, describe, test } from 'node:test';
import { expect } from 'expect';
import { UUID_FORMAT } from '@verii/test-regexes';
import VCLSubmission from '../../src/api/entities/VCLSubmission';
import VCLPresentationSubmission from '../../src/api/entities/VCLPresentationSubmission';
import { PresentationSubmissionMocks } from '../infrastructure/resources/valid/PresentationSubmissionMocks';
import { JwtMocks } from '../infrastructure/resources/valid/JwtMocks';
import VCLIdentificationSubmission from '../../src/api/entities/VCLIdentificationSubmission';
import { IdentificationSubmissionMocks } from '../infrastructure/resources/valid/IdentificationSubmissionMocks';

const createExpectedPayload = ({
    iss,
    presentationDefinitionId,
    vendorOriginContext,
}: {
    iss: string;
    presentationDefinitionId: string;
    vendorOriginContext?: string | null;
}) => ({
    [VCLSubmission.KeyJti]: expect.stringMatching(UUID_FORMAT),
    [VCLSubmission.KeyIss]: iss,
    [VCLSubmission.KeyVp]: {
        [VCLSubmission.KeyContext]: VCLSubmission.ValueContextList,
        [VCLSubmission.KeyType]: VCLSubmission.ValueVerifiablePresentation,
        [VCLSubmission.KeyPresentationSubmission]: {
            [VCLSubmission.KeyId]: expect.stringMatching(UUID_FORMAT),
            [VCLSubmission.KeyDefinitionId]: presentationDefinitionId,
            [VCLSubmission.KeyDescriptorMap]:
                PresentationSubmissionMocks.SelectionsList.map(
                    (credential, index) => ({
                        [VCLSubmission.KeyId]: credential.inputDescriptor,
                        [VCLSubmission.KeyPath]: `$.verifiableCredential[${index}]`,
                        [VCLSubmission.KeyFormat]: VCLSubmission.ValueJwtVc,
                    }),
                ),
        },
        [VCLSubmission.KeyVerifiableCredential]:
            PresentationSubmissionMocks.SelectionsList.map(
                (credential) => credential.jwtVc,
            ),
        ...(vendorOriginContext
            ? {
                  [VCLSubmission.KeyVendorOriginContext]: vendorOriginContext,
              }
            : {}),
    },
});

describe('VCLSubmission', () => {
    let subjectPresentationSubmission: VCLSubmission;

    let subjectIdentificationSubmission: VCLSubmission;

    beforeEach(() => {
        subjectPresentationSubmission = new VCLPresentationSubmission(
            PresentationSubmissionMocks.PresentationRequest,
            PresentationSubmissionMocks.SelectionsList,
        );
        subjectIdentificationSubmission = new VCLIdentificationSubmission(
            IdentificationSubmissionMocks.CredentialManifest,
            PresentationSubmissionMocks.SelectionsList,
        );
    });

    test('exposes the submission payload', () => {
        expect(
            subjectPresentationSubmission.generatePayload('inspection iss'),
        ).toEqual(
            createExpectedPayload({
                iss: 'inspection iss',
                presentationDefinitionId:
                    PresentationSubmissionMocks.PresentationRequest
                        .presentationDefinitionId,
                vendorOriginContext:
                    PresentationSubmissionMocks.PresentationRequest
                        .vendorOriginContext,
            }),
        );
        expect(
            subjectIdentificationSubmission.generatePayload('issuing iss'),
        ).toEqual(
            createExpectedPayload({
                iss: 'issuing iss',
                presentationDefinitionId:
                    IdentificationSubmissionMocks.CredentialManifest
                        .presentationDefinitionId,
                vendorOriginContext:
                    IdentificationSubmissionMocks.CredentialManifest
                        .vendorOriginContext,
            }),
        );
    });

    test('generates the submission request body', () => {
        expect(
            subjectPresentationSubmission.generateRequestBody(JwtMocks.JWT),
        ).toEqual({
            [VCLSubmission.KeyExchangeId]:
                PresentationSubmissionMocks.PresentationRequest.exchangeId,
            [VCLSubmission.KeyJwtVp]: JwtMocks.JWT.signedJwt.serialize(),
            [VCLSubmission.KeyPushDelegate]: {
                pushUrl: PresentationSubmissionMocks.PushDelegate.pushUrl,
                pushToken: PresentationSubmissionMocks.PushDelegate.pushToken,
            },
        });
    });
});
