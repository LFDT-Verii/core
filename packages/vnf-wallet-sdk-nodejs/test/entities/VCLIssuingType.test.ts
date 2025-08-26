import { describe, test } from 'node:test';
import { expect } from 'expect';
import { issuingTypeFromString, VCLIssuingType } from '../../src';

describe('VCLIssuingType Tests', () => {
    test('testFromExactString', () => {
        expect(issuingTypeFromString('Career')).toEqual(VCLIssuingType.Career);
        expect(issuingTypeFromString('Identity')).toEqual(
            VCLIssuingType.Identity
        );
        expect(issuingTypeFromString('Refresh')).toEqual(
            VCLIssuingType.Refresh
        );
        expect(issuingTypeFromString('Undefined')).toEqual(
            VCLIssuingType.Undefined
        );
    });

    test('testFromNonExactString', () => {
        expect(issuingTypeFromString('11_Career6_2')).toEqual(
            VCLIssuingType.Career
        );
        expect(issuingTypeFromString('hyre_8Identity09_nf')).toEqual(
            VCLIssuingType.Identity
        );
        expect(issuingTypeFromString('hyrek_yRefresho89#l')).toEqual(
            VCLIssuingType.Refresh
        );
        expect(issuingTypeFromString('')).toEqual(VCLIssuingType.Undefined);
    });
});
