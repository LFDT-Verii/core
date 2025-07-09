import { Dictionary, Nullish } from '../VCLTypes';

export default class VCLCredentialType {
    constructor(
        public payload: Dictionary<any>,
        public id: Nullish<string> = null,
        public schema: Nullish<string> = null,
        public createdAt: Nullish<string> = null,
        public schemaName: Nullish<string> = null,
        public credentialType: Nullish<string> = null,
        public recommended: boolean = false
    ) {}

    // CodingKeys
    static readonly KeyId = 'id';

    static readonly KeySchema = 'schema';

    static readonly KeyCreatedAt = 'createdAt';

    static readonly KeySchemaName = 'schemaName';

    static readonly KeyCredentialType = 'credentialType';

    static readonly KeyRecommended = 'recommended';
}
