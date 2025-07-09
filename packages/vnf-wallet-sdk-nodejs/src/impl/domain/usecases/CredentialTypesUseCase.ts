import VCLCredentialTypes from '../../../api/entities/VCLCredentialTypes';

export interface CredentialTypesUseCase {
    getCredentialTypes(): Promise<VCLCredentialTypes>;
}
