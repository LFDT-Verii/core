import { Nullish } from '../VCLTypes';
import VCLCountry from './VCLCountry';

export default class VCLCountries {
    all: Nullish<VCLCountry[]>;

    constructor(all: VCLCountry[]) {
        this.all = all;
    }

    countryByCode(code: string): Nullish<VCLCountry> {
        return this.countryBy(VCLCountry.KeyCode, code);
    }

    private countryBy(key: string, value: string): Nullish<VCLCountry> {
        return this.all?.find((country) => country.payload[key] === value);
    }
}
