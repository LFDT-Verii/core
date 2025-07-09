import VCLCredentialTypeSchema from '../../../api/entities/VCLCredentialTypeSchema';

export default interface CredentialTypeSchemaRepository {
    getCredentialTypeSchema(
        schemaName: string
    ): Promise<VCLCredentialTypeSchema>;
}
