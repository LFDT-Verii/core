/* eslint-disable max-len */
import { expect } from '@jest/globals';
import {
    VCLCredentialManifest,
    VCLDeepLink,
    VCLJwt,
    VCLVerifiedProfile,
} from '../../src';
import { CredentialManifestMocks } from '../infrastructure/resources/valid/CredentialManifestMocks';
import { DidJwkMocks } from '../infrastructure/resources/valid/DidJwkMocks';

describe('VCLCredentialManifest Tests', () => {
    const subject: VCLCredentialManifest = new VCLCredentialManifest(
        VCLJwt.fromEncodedJwt(CredentialManifestMocks.JwtCredentialManifest1),
        null,
        new VCLVerifiedProfile({}),
        new VCLDeepLink(''),
        DidJwkMocks.DidJwk
    );
    test('VCLCredentialManifest props', () => {
        expect(subject.iss).toEqual(
            'did:ion:EiApMLdMb4NPb8sae9-hXGHP79W1gisApVSE80USPEbtJA'
        );
        expect(subject.did).toEqual(
            'did:ion:EiApMLdMb4NPb8sae9-hXGHP79W1gisApVSE80USPEbtJA'
        );
        expect(subject.issuerId).toEqual(
            'did:ion:EiApMLdMb4NPb8sae9-hXGHP79W1gisApVSE80USPEbtJA'
        );
        expect(subject.aud).toEqual(
            'https://devagent.velocitycareerlabs.io/api/holder/v0.6/org/did:ion:EiApMLdMb4NPb8sae9-hXGHP79W1gisApVSE80USPEbtJA'
        );
        expect(subject.exchangeId).toEqual('645e315309237c760ac022b1');
        expect(subject.presentationDefinitionId).toEqual(
            '645e315309237c760ac022b1.6384a3ad148b1991687f67c9'
        );
        expect(subject.finalizeOffersUri).toEqual(
            'https://devagent.velocitycareerlabs.io/api/holder/v0.6/org/did:ion:EiApMLdMb4NPb8sae9-hXGHP79W1gisApVSE80USPEbtJA/issue/finalize-offers'
        );
        expect(subject.checkOffersUri).toEqual(
            'https://devagent.velocitycareerlabs.io/api/holder/v0.6/org/did:ion:EiApMLdMb4NPb8sae9-hXGHP79W1gisApVSE80USPEbtJA/issue/credential-offers'
        );
        expect(subject.submitPresentationUri).toEqual(
            'https://devagent.velocitycareerlabs.io/api/holder/v0.6/org/did:ion:EiApMLdMb4NPb8sae9-hXGHP79W1gisApVSE80USPEbtJA/issue/submit-identification'
        );
    });
});
