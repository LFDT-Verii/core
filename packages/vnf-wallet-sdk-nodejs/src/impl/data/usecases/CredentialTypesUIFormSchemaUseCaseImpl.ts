import VCLCountries from '../../../api/entities/VCLCountries';
import VCLCredentialTypesUIFormSchema from '../../../api/entities/VCLCredentialTypesUIFormSchema';
import VCLCredentialTypesUIFormSchemaDescriptor from '../../../api/entities/VCLCredentialTypesUIFormSchemaDescriptor';
import CredentialTypesUIFormSchemaRepository from '../../domain/repositories/CredentialTypesUIFormSchemaRepository';
import CredentialTypesUIFormSchemaUseCase from '../../domain/usecases/CredentialTypesUIFormSchemaUseCase';
import VCLError from '../../../api/entities/error/VCLError';

export default class CredentialTypesUIFormSchemaUseCaseImpl
    implements CredentialTypesUIFormSchemaUseCase
{
    constructor(
        private readonly credentialTypesUIFormSchemaRepository: CredentialTypesUIFormSchemaRepository
    ) {}

    async getCredentialTypesUIFormSchema(
        credentialTypesUIFormSchemaDescriptor: VCLCredentialTypesUIFormSchemaDescriptor,
        countries: VCLCountries
    ): Promise<VCLCredentialTypesUIFormSchema> {
        try {
            return await this.credentialTypesUIFormSchemaRepository.getCredentialTypesUIFormSchema(
                credentialTypesUIFormSchemaDescriptor,
                countries
            );
        } catch (error: any) {
            throw VCLError.fromError(error);
        }
    }
}
