import VCLCountries from '../../../api/entities/VCLCountries';
import VCLCredentialTypesUIFormSchema from '../../../api/entities/VCLCredentialTypesUIFormSchema';
import VCLCredentialTypesUIFormSchemaDescriptor from '../../../api/entities/VCLCredentialTypesUIFormSchemaDescriptor';

export default interface CredentialTypesUIFormSchemaRepository {
    getCredentialTypesUIFormSchema(
        credentialTypesUIFormSchemaDescriptor: VCLCredentialTypesUIFormSchemaDescriptor,
        countries: VCLCountries
    ): Promise<VCLCredentialTypesUIFormSchema>;
}
