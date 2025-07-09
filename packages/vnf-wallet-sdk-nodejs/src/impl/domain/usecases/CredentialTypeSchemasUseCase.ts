import VCLCredentialTypeSchemas from '../../../api/entities/VCLCredentialTypeSchemas';

export default interface CredentialTypeSchemasUseCase {
    getCredentialTypeSchemas(): Promise<VCLCredentialTypeSchemas>;
}
