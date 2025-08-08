import { describe, test } from 'node:test';
import { expect } from 'expect';
import VCLServiceTypes from '../../src/api/entities/VCLServiceTypes';
import VCLServiceType from '../../src/api/entities/VCLServiceType';
import { VCLIssuingType } from '../../src';

describe('VCLServiceTypes Tests', () => {
    test('testContainsFull', () => {
        const serviceTypes = new VCLServiceTypes([
            VCLServiceType.Issuer,
            VCLServiceType.Inspector,
            VCLServiceType.CareerIssuer,
            VCLServiceType.NotaryIssuer,
            VCLServiceType.IdentityIssuer,
        ]);

        expect(serviceTypes.contains(VCLServiceType.Issuer)).toBeTruthy();
        expect(serviceTypes.contains(VCLServiceType.Inspector)).toBeTruthy();
        expect(serviceTypes.contains(VCLServiceType.CareerIssuer)).toBeTruthy();
        expect(serviceTypes.contains(VCLServiceType.NotaryIssuer)).toBeTruthy();
        expect(
            serviceTypes.contains(VCLServiceType.IdentityIssuer)
        ).toBeTruthy();

        expect(
            serviceTypes.containsAtLeastOneOf(
                new VCLServiceTypes([
                    VCLServiceType.IdentityIssuer,
                    VCLServiceType.Inspector,
                    VCLServiceType.NotaryIssuer,
                ])
            )
        ).toBeTruthy();

        expect(serviceTypes.contains(VCLServiceType.Undefined)).toBeFalsy();
        expect(
            serviceTypes.containsAtLeastOneOf(
                new VCLServiceTypes([VCLServiceType.Undefined])
            )
        ).toBeFalsy();
    });

    test('testContainsPartial', () => {
        const serviceTypes = new VCLServiceTypes([
            VCLServiceType.Issuer,
            VCLServiceType.Inspector,
            VCLServiceType.CareerIssuer,
        ]);

        expect(serviceTypes.contains(VCLServiceType.Issuer)).toBeTruthy();
        expect(serviceTypes.contains(VCLServiceType.Inspector)).toBeTruthy();
        expect(serviceTypes.contains(VCLServiceType.CareerIssuer)).toBeTruthy();

        expect(
            serviceTypes.containsAtLeastOneOf(
                new VCLServiceTypes([VCLServiceType.Inspector])
            )
        ).toBeTruthy();

        expect(serviceTypes.contains(VCLServiceType.NotaryIssuer)).toBeFalsy();
        expect(
            serviceTypes.contains(VCLServiceType.IdentityIssuer)
        ).toBeFalsy();
        expect(serviceTypes.contains(VCLServiceType.Undefined)).toBeFalsy();

        expect(
            serviceTypes.containsAtLeastOneOf(
                new VCLServiceTypes([VCLServiceType.IdentityIssuer])
            )
        ).toBeFalsy();
    });

    test('testContainsEmpty', () => {
        const serviceTypes = new VCLServiceTypes([]);

        expect(serviceTypes.contains(VCLServiceType.Issuer)).toBeFalsy();
        expect(serviceTypes.contains(VCLServiceType.Inspector)).toBeFalsy();
        expect(serviceTypes.contains(VCLServiceType.CareerIssuer)).toBeFalsy();
        expect(serviceTypes.contains(VCLServiceType.NotaryIssuer)).toBeFalsy();
        expect(
            serviceTypes.contains(VCLServiceType.IdentityIssuer)
        ).toBeFalsy();
        expect(serviceTypes.contains(VCLServiceType.Undefined)).toBeFalsy();

        expect(
            serviceTypes.containsAtLeastOneOf(
                new VCLServiceTypes([
                    VCLServiceType.Issuer,
                    VCLServiceType.Inspector,
                    VCLServiceType.CareerIssuer,
                    VCLServiceType.NotaryIssuer,
                    VCLServiceType.IdentityIssuer,
                ])
            )
        ).toBeFalsy();
    });

    test('testFromCareer', () => {
        const serviceTypes = VCLServiceTypes.fromIssuingType(
            VCLIssuingType.Career
        );

        expect(serviceTypes.contains(VCLServiceType.Issuer)).toBeTruthy();
        expect(serviceTypes.contains(VCLServiceType.CareerIssuer)).toBeTruthy();
        expect(serviceTypes.contains(VCLServiceType.NotaryIssuer)).toBeTruthy();

        expect(
            serviceTypes.containsAtLeastOneOf(
                new VCLServiceTypes([
                    VCLServiceType.Inspector,
                    VCLServiceType.NotaryIssuer,
                ])
            )
        ).toBeTruthy();

        expect(
            serviceTypes.contains(VCLServiceType.IdentityIssuer)
        ).toBeFalsy();
        expect(serviceTypes.contains(VCLServiceType.Undefined)).toBeFalsy();

        expect(
            serviceTypes.containsAtLeastOneOf(
                new VCLServiceTypes([VCLServiceType.Inspector])
            )
        ).toBeFalsy();
    });

    test('testFromIdentity', () => {
        const serviceTypes = VCLServiceTypes.fromIssuingType(
            VCLIssuingType.Identity
        );

        expect(
            serviceTypes.contains(VCLServiceType.IdentityIssuer)
        ).toBeTruthy();

        expect(
            serviceTypes.containsAtLeastOneOf(
                new VCLServiceTypes([
                    VCLServiceType.IdentityIssuer,
                    VCLServiceType.Inspector,
                ])
            )
        ).toBeTruthy();

        expect(serviceTypes.contains(VCLServiceType.Issuer)).toBeFalsy();
        expect(serviceTypes.contains(VCLServiceType.CareerIssuer)).toBeFalsy();
        expect(serviceTypes.contains(VCLServiceType.NotaryIssuer)).toBeFalsy();
        expect(serviceTypes.contains(VCLServiceType.Undefined)).toBeFalsy();

        expect(
            serviceTypes.containsAtLeastOneOf(
                new VCLServiceTypes([
                    VCLServiceType.Issuer,
                    VCLServiceType.Inspector,
                ])
            )
        ).toBeFalsy();
    });

    test('testFromRefresh', () => {
        const serviceTypes = VCLServiceTypes.fromIssuingType(
            VCLIssuingType.Refresh
        );

        expect(
            serviceTypes.contains(VCLServiceType.IdentityIssuer)
        ).toBeTruthy();
        expect(serviceTypes.contains(VCLServiceType.Issuer)).toBeTruthy();
        expect(serviceTypes.contains(VCLServiceType.CareerIssuer)).toBeTruthy();
        expect(serviceTypes.contains(VCLServiceType.NotaryIssuer)).toBeTruthy();

        expect(
            serviceTypes.containsAtLeastOneOf(
                new VCLServiceTypes([
                    VCLServiceType.IdentityIssuer,
                    VCLServiceType.Inspector,
                ])
            )
        ).toBeTruthy();

        expect(serviceTypes.contains(VCLServiceType.Undefined)).toBeFalsy();

        expect(
            serviceTypes.containsAtLeastOneOf(
                new VCLServiceTypes([VCLServiceType.Inspector])
            )
        ).toBeFalsy();
    });

    test('testFromUndefined', () => {
        const serviceTypes = VCLServiceTypes.fromIssuingType(
            VCLIssuingType.Undefined
        );

        expect(serviceTypes.contains(VCLServiceType.Undefined)).toBeFalsy();
    });
});
