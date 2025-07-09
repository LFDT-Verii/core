import { Dictionary, Nullish } from '../VCLTypes';
import VCLPlace from './VCLPlace';
import VCLRegions from './VCLRegions';

export default class VCLCountry extends VCLPlace {
    constructor(
        public payload: Dictionary<any>,
        public code: string,
        public name: string,
        public regions: Nullish<VCLRegions>
    ) {
        super(payload, code, name);
    }

    static KeyCode = 'code';

    static KeyName = 'name';

    static KeyRegions = 'regions';
}
