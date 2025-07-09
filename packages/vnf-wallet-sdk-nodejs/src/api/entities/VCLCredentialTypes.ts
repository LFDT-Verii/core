import { Dictionary, Nullish } from '../VCLTypes';
import VCLCredentialType from './VCLCredentialType';

export default class VCLCredentialTypes {
    constructor(
        public payload: Dictionary<any>,
        public all: Nullish<VCLCredentialType[]>
    ) {}

    get recommendedTypes(): Nullish<VCLCredentialType[]> {
        return this.all?.filter((item) => item.recommended);
    }

    static fromPayload(payload: Dictionary<any>): VCLCredentialTypes {
        return new VCLCredentialTypes(
            payload,
            (payload as Dictionary<any>[]).map((item: Dictionary<any>) => {
                return new VCLCredentialType(
                    item,
                    item[VCLCredentialType.KeyId],
                    item[VCLCredentialType.KeySchema],
                    item[VCLCredentialType.KeyCreatedAt],
                    item[VCLCredentialType.KeySchemaName],
                    item[VCLCredentialType.KeyCredentialType],
                    item[VCLCredentialType.KeyRecommended]
                );
            })
        );
    }
}
