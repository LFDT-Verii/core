import VCLCredentialTypes from '../../../api/entities/VCLCredentialTypes';

export default interface CredentialTypesRepository {
    getCredentialTypes(): Promise<VCLCredentialTypes>;
}
