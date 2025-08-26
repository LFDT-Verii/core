/* eslint-disable max-len */

import { before, describe, test } from 'node:test';
import { expect } from 'expect';
import {
    VCLCredentialManifest,
    VCLDeepLink,
    VCLFinalizeOffersDescriptor,
    VCLJwt,
    VCLVerifiedProfile,
} from '../../src';
import { CredentialManifestMocks } from '../infrastructure/resources/valid/CredentialManifestMocks';
import { DidJwkMocks } from '../infrastructure/resources/valid/DidJwkMocks';
import { VerifiedProfileMocks } from '../infrastructure/resources/valid/VerifiedProfileMocks';

describe('VCLCredentialManifest Tests', () => {
    let subject: VCLFinalizeOffersDescriptor;

    // const jtiMock = "some jti"
    // const issMock = "some iss"
    // const audMock = "some sud"
    const nonceMock = 'some nonce';

    const approvedOfferIds = ['approvedOfferId1', 'approvedOfferId2'];
    const rejectedOfferIds = ['rejectedOfferId1', 'rejectedOfferId2'];

    const jwtProof = VCLJwt.fromEncodedJwt(
        'eyJraWQiOiJkaWQ6andrOmV5SnJkSGtpT2lKRlF5SXNJblZ6WlNJNkluTnBaeUlzSW1OeWRpSTZJbEF0TWpVMklpd2lhMmxrSWpvaVpHSmlNVGd5TXpndE56a3hZaTAwTmpkaUxXRTBZak10T0RjeE0yVTFNVGN3TkRObElpd2llQ0k2SWs1NVkxcEhhMmt5U1ZGRldta3pVRmN0UXkwNVIzRjNRakJsZDNVNWR6QkdXV2xrTTFaVmJGOTJPRFFpTENKNUlqb2liVXhtY1dNMmIyWXhVVFYwVHpZeGQwbDFkVFpQVVZaUmMySjRUR1poT0VkaGMwaFZUR3B3VTJWVmJ5SjkjMCIsInR5cCI6IkpXVCIsImFsZyI6IkVTMjU2IiwiandrIjp7Imt0eSI6IkVDIiwidXNlIjoic2lnIiwiY3J2IjoiUC0yNTYiLCJraWQiOiJkYmIxODIzOC03OTFiLTQ2N2ItYTRiMy04NzEzZTUxNzA0M2UiLCJ4IjoiTnljWkdraTJJUUVaaTNQVy1DLTlHcXdCMGV3dTl3MEZZaWQzVlVsX3Y4NCIsInkiOiJtTGZxYzZvZjFRNXRPNjF3SXV1Nk9RVlFzYnhMZmE4R2FzSFVManBTZVVvIn19.eyJhdWQiOiJzb21lIHN1ZCIsInN1YiI6IlB2aFNOdWF6MTYiLCJuYmYiOjE3MTc0ODk2NzksImlzcyI6InNvbWUgaXNzIiwiZXhwIjoxNzE4MDk0NDc5LCJpYXQiOjE3MTc0ODk2NzksIm5vbmNlIjoic29tZSBub25jZSIsImp0aSI6InNvbWUganRpIn0.VRacheqy4sWIo3CKPsOJTYJnfyx3KaFYIQykXIS4xpMs58iCCp-pRnsLmoC56eJPCqRkv_A-MCdpc3pgiM3UVA'
    );
    const expectedRequestBodyStr =
        '{"exchangeId":"645e315309237c760ac022b1","approvedOfferIds":["approvedOfferId1","approvedOfferId2"],"rejectedOfferIds":["rejectedOfferId1","rejectedOfferId2"],"proof":{"proof_type":"jwt","jwt":"eyJraWQiOiJkaWQ6andrOmV5SnJkSGtpT2lKRlF5SXNJblZ6WlNJNkluTnBaeUlzSW1OeWRpSTZJbEF0TWpVMklpd2lhMmxrSWpvaVpHSmlNVGd5TXpndE56a3hZaTAwTmpkaUxXRTBZak10T0RjeE0yVTFNVGN3TkRObElpd2llQ0k2SWs1NVkxcEhhMmt5U1ZGRldta3pVRmN0UXkwNVIzRjNRakJsZDNVNWR6QkdXV2xrTTFaVmJGOTJPRFFpTENKNUlqb2liVXhtY1dNMmIyWXhVVFYwVHpZeGQwbDFkVFpQVVZaUmMySjRUR1poT0VkaGMwaFZUR3B3VTJWVmJ5SjkjMCIsInR5cCI6IkpXVCIsImFsZyI6IkVTMjU2IiwiandrIjp7Imt0eSI6IkVDIiwidXNlIjoic2lnIiwiY3J2IjoiUC0yNTYiLCJraWQiOiJkYmIxODIzOC03OTFiLTQ2N2ItYTRiMy04NzEzZTUxNzA0M2UiLCJ4IjoiTnljWkdraTJJUUVaaTNQVy1DLTlHcXdCMGV3dTl3MEZZaWQzVlVsX3Y4NCIsInkiOiJtTGZxYzZvZjFRNXRPNjF3SXV1Nk9RVlFzYnhMZmE4R2FzSFVManBTZVVvIn19.eyJhdWQiOiJzb21lIHN1ZCIsInN1YiI6IlB2aFNOdWF6MTYiLCJuYmYiOjE3MTc0ODk2NzksImlzcyI6InNvbWUgaXNzIiwiZXhwIjoxNzE4MDk0NDc5LCJpYXQiOjE3MTc0ODk2NzksIm5vbmNlIjoic29tZSBub25jZSIsImp0aSI6InNvbWUganRpIn0.VRacheqy4sWIo3CKPsOJTYJnfyx3KaFYIQykXIS4xpMs58iCCp-pRnsLmoC56eJPCqRkv_A-MCdpc3pgiM3UVA"}}';

    before(async () => {
        const credentialManifest = new VCLCredentialManifest(
            VCLJwt.fromEncodedJwt(
                CredentialManifestMocks.JwtCredentialManifest1
            ),
            null,
            new VCLVerifiedProfile(
                JSON.parse(VerifiedProfileMocks.VerifiedProfileIssuerJsonStr1)
            ),
            new VCLDeepLink(''),
            DidJwkMocks.DidJwk
        );
        subject = new VCLFinalizeOffersDescriptor(
            credentialManifest,
            '',
            approvedOfferIds,
            rejectedOfferIds
        );
    });

    test('test props', async () => {
        expect(subject.finalizeOffersUri).toEqual(
            'https://devagent.velocitycareerlabs.io/api/holder/v0.6/org/did:ion:EiApMLdMb4NPb8sae9-hXGHP79W1gisApVSE80USPEbtJA/issue/finalize-offers'
        );
        expect(subject.approvedOfferIds).toStrictEqual(approvedOfferIds);
        expect(subject.rejectedOfferIds).toStrictEqual(rejectedOfferIds);
        expect(subject.aud).toEqual(
            'https://devagent.velocitycareerlabs.io/api/holder/v0.6/org/did:ion:EiApMLdMb4NPb8sae9-hXGHP79W1gisApVSE80USPEbtJA'
        );
        expect(subject.issuerId).toEqual(
            'did:ion:EiApMLdMb4NPb8sae9-hXGHP79W1gisApVSE80USPEbtJA'
        );
    });

    test('test generateRequest body', async () => {
        const requestBody = subject.generateRequestBody(jwtProof);

        expect(requestBody).toStrictEqual(JSON.parse(expectedRequestBodyStr));

        expect(requestBody.exchangeId).toEqual('645e315309237c760ac022b1');
        expect(requestBody.approvedOfferIds).toStrictEqual(approvedOfferIds);
        expect(requestBody.rejectedOfferIds).toStrictEqual(rejectedOfferIds);
        const { proof } = requestBody;
        expect(proof.proof_type).toEqual('jwt');
        expect(proof.jwt).toEqual(jwtProof.encodedJwt);
        //        equivalent to checking nonce in proof jwt
        expect(jwtProof.payload.nonce).toEqual(nonceMock);
    });
});
