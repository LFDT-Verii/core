/*
data class VCLOrganizations(val all: List<VCLOrganization>) {
    companion object CodingKeys {
        const val KeyResult = "result"
    }
} */

import VCLOrganization from './VCLOrganization';

export default class VCLOrganizations {
    constructor(public readonly all: VCLOrganization[]) {}

    static readonly KeyResult = 'result';
}
