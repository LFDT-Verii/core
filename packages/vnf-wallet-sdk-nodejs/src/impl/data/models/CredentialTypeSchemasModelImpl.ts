import VCLCredentialTypeSchemas from '../../../api/entities/VCLCredentialTypeSchemas';
import VCLError from '../../../api/entities/error/VCLError';
import CredentialTypeSchemasModel from '../../domain/models/CredentialTypeSchemasModel';
import CredentialTypeSchemasUseCase from '../../domain/usecases/CredentialTypeSchemasUseCase';
import { Nullish } from '../../../api/VCLTypes';

export default class CredentialTypeSchemasModelImpl
    implements CredentialTypeSchemasModel
{
    constructor(
        private readonly credentialTypeSchemasUseCase: CredentialTypeSchemasUseCase
    ) {}

    data: Nullish<VCLCredentialTypeSchemas>;

    async initialize(): Promise<VCLError | null> {
        this.data =
            await this.credentialTypeSchemasUseCase.getCredentialTypeSchemas();
        return null;
    }
}
