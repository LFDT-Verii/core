import VCLCredentialType from '../../../api/entities/VCLCredentialType';
import VCLCredentialTypeSchema from '../../../api/entities/VCLCredentialTypeSchema';
import VCLCredentialTypeSchemas from '../../../api/entities/VCLCredentialTypeSchemas';
import VCLCredentialTypes from '../../../api/entities/VCLCredentialTypes';
import CredentialTypeSchemaRepository from '../../domain/repositories/CredentialTypeSchemaRepository';
import CredentialTypeSchemasUseCase from '../../domain/usecases/CredentialTypeSchemasUseCase';
import VCLError from '../../../api/entities/error/VCLError';
import VCLLog from '../../utils/VCLLog';

export default class CredentialTypeSchemasUseCaseImpl
    implements CredentialTypeSchemasUseCase
{
    constructor(
        private readonly credentialTypeSchemaRepository: CredentialTypeSchemaRepository,
        private readonly credentialTypes: VCLCredentialTypes
    ) {}

    async getCredentialTypeSchemas(): Promise<VCLCredentialTypeSchemas> {
        try {
            const credentialTypeSchemasMap: {
                [key: string]: VCLCredentialTypeSchema;
            } = {};

            const schemaNamesArr: string[] =
                this.credentialTypes.all
                    ?.filter((it) => {
                        return it.schemaName != null;
                    })
                    .map<string>((it: VCLCredentialType) => {
                        return it.schemaName!;
                    }) ?? [];

            for (const schemaName of schemaNamesArr) {
                // eslint-disable-next-line max-depth
                try {
                    credentialTypeSchemasMap[schemaName] =
                        // eslint-disable-next-line no-await-in-loop
                        await this.credentialTypeSchemaRepository.getCredentialTypeSchema(
                            schemaName
                        );
                } catch (error: any) {
                    VCLLog.error(
                        error,
                        `Error fetching schema for ${schemaName}`
                    );
                }
            }
            return new VCLCredentialTypeSchemas(credentialTypeSchemasMap);
        } catch (error: any) {
            throw VCLError.fromError(error);
        }
    }
}
