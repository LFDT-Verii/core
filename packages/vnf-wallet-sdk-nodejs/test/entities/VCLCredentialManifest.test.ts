import { describe, test } from 'node:test';
import { expect } from 'expect';
import { VCLCredentialManifest, VCLJwt, VCLVerifiedProfile } from '../../src';
import { CredentialManifestMocks } from '../infrastructure/resources/valid/CredentialManifestMocks';
import { DeepLinkMocks } from '../infrastructure/resources/valid/DeepLinkMocks';
import { DidJwkMocks } from '../infrastructure/resources/valid/DidJwkMocks';

describe('VCLCredentialManifest', () => {
    const issuerId = 'did:ion:EiApMLdMb4NPb8sae9-hXGHP79W1gisApVSE80USPEbtJA';
    const holderBaseUrl =
        'https://devagent.velocitycareerlabs.io/api/holder/v0.6/org';
    const issuerBaseUrl = `${holderBaseUrl}/${issuerId}`;
    const subject: VCLCredentialManifest = new VCLCredentialManifest(
        VCLJwt.fromEncodedJwt(CredentialManifestMocks.JwtCredentialManifest1),
        null,
        new VCLVerifiedProfile({}),
        DeepLinkMocks.CredentialManifestDeepLinkMainNet,
        DidJwkMocks.DidJwk,
    );
    test('exposes credential manifest properties', () => {
        expect(subject.iss).toEqual(issuerId);
        expect(subject.did).toEqual(issuerId);
        expect(subject.issuerId).toEqual(issuerId);
        expect(subject.aud).toEqual(issuerBaseUrl);
        expect(subject.exchangeId).toEqual('645e315309237c760ac022b1');
        expect(subject.presentationDefinitionId).toEqual(
            '645e315309237c760ac022b1.6384a3ad148b1991687f67c9',
        );
        expect(subject.finalizeOffersUri).toEqual(
            `${issuerBaseUrl}/issue/finalize-offers`,
        );
        expect(subject.checkOffersUri).toEqual(
            `${issuerBaseUrl}/issue/credential-offers`,
        );
        expect(subject.submitPresentationUri).toEqual(
            `${issuerBaseUrl}/issue/submit-identification`,
        );
    });
});
