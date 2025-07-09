import VCLCredentialTypes from '../../../api/entities/VCLCredentialTypes';
import CredentialTypesRepository from '../../domain/repositories/CredentialTypesRepository';
import { CredentialTypesUseCase } from '../../domain/usecases/CredentialTypesUseCase';
import VCLError from '../../../api/entities/error/VCLError';

export default class CredentialTypesUseCaseImpl
    implements CredentialTypesUseCase
{
    constructor(private readonly credentialTypes: CredentialTypesRepository) {}

    async getCredentialTypes(): Promise<VCLCredentialTypes> {
        try {
            return await this.credentialTypes.getCredentialTypes();
        } catch (error: any) {
            throw VCLError.fromError(error);
        }
    }
}
