import { Dictionary } from '../VCLTypes';

export default class VCLCredentialTypesUIFormSchema {
    constructor(public payload: Dictionary<any>) {}

    // CodingKeys
    static readonly KeyAddressRegion = 'addressRegion';

    static readonly KeyAddressCountry = 'addressCountry';

    static readonly KeyUiEnum = 'ui:enum';

    static readonly KeyUiNames = 'ui:enumNames';
}
