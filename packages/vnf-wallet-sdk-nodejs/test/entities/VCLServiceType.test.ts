import { describe, test } from 'node:test';
import { expect } from 'expect';
import VCLServiceType, {
    serviceTypeFromString,
} from '../../src/api/entities/VCLServiceType';

describe('VCLServiceType Tests', () => {
    test('testFromExactString', () => {
        expect(serviceTypeFromString('Inspector')).toEqual(
            VCLServiceType.Inspector
        );
        expect(serviceTypeFromString('CareerIssuer')).toEqual(
            VCLServiceType.CareerIssuer
        );
        expect(serviceTypeFromString('NotaryIssuer')).toEqual(
            VCLServiceType.NotaryIssuer
        );
        expect(serviceTypeFromString('IdentityIssuer')).toEqual(
            VCLServiceType.IdentityIssuer
        );
        expect(serviceTypeFromString('CareerIssuer')).toEqual(
            VCLServiceType.CareerIssuer
        );
        expect(serviceTypeFromString('IdDocumentIssuer')).toEqual(
            VCLServiceType.IdDocumentIssuer
        );
        expect(serviceTypeFromString('NotaryIdDocumentIssuer')).toEqual(
            VCLServiceType.NotaryIdDocumentIssuer
        );
        expect(serviceTypeFromString('NotaryContactIssuer')).toEqual(
            VCLServiceType.NotaryContactIssuer
        );
        expect(serviceTypeFromString('ContactIssuer')).toEqual(
            VCLServiceType.ContactIssuer
        );
        expect(serviceTypeFromString('Issuer')).toEqual(VCLServiceType.Issuer);
        expect(serviceTypeFromString('OtherService')).toEqual(
            VCLServiceType.Undefined
        );
        expect(serviceTypeFromString('Undefined')).toEqual(
            VCLServiceType.Undefined
        );
    });

    test('testFromNonExactString', () => {
        expect(serviceTypeFromString(',dfm%InspectorGH*(T')).toEqual(
            VCLServiceType.Inspector
        );
        expect(serviceTypeFromString('234CareerIssuer95R')).toEqual(
            VCLServiceType.CareerIssuer
        );
        expect(serviceTypeFromString('*%$NotaryIssuer3k42j2n4')).toEqual(
            VCLServiceType.NotaryIssuer
        );
        expect(serviceTypeFromString('9834RFIdentityIssuer^3&^')).toEqual(
            VCLServiceType.IdentityIssuer
        );
        expect(serviceTypeFromString('iu34CareerIssuer^#4f')).toEqual(
            VCLServiceType.CareerIssuer
        );
        expect(serviceTypeFromString('398%IdDocumentIssuer^DDd3')).toEqual(
            VCLServiceType.IdDocumentIssuer
        );
        expect(
            serviceTypeFromString('3kjnke9@NotaryIdDocumentIssuer@%^')
        ).toEqual(VCLServiceType.NotaryIdDocumentIssuer);
        expect(serviceTypeFromString('03fNotaryContactIssuer04gvd')).toEqual(
            VCLServiceType.NotaryContactIssuer
        );
        expect(serviceTypeFromString('0fhe3ContactIssuer43f')).toEqual(
            VCLServiceType.ContactIssuer
        );
        expect(serviceTypeFromString('eskld#Issuerdkdf')).toEqual(
            VCLServiceType.Issuer
        );
        expect(serviceTypeFromString('ksdjhkD#OtherService959)%')).toEqual(
            VCLServiceType.Undefined
        );
        expect(serviceTypeFromString('#Wfg85$Undefined)%dgsc')).toEqual(
            VCLServiceType.Undefined
        );
        expect(serviceTypeFromString('')).toEqual(VCLServiceType.Undefined);
    });
});
