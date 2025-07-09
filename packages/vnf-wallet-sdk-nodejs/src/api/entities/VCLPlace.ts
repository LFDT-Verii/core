import { Dictionary } from '../VCLTypes';

export default class VCLPlace {
    constructor(
        public readonly payload: Dictionary<any>,
        public readonly code: string,
        public readonly name: string
    ) {}
}
