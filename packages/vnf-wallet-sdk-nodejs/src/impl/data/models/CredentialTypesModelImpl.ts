import VCLCredentialTypes from '../../../api/entities/VCLCredentialTypes';
import VCLError from '../../../api/entities/error/VCLError';
import CredentialTypesModel from '../../domain/models/CredentialTypesModel';
import { CredentialTypesUseCase } from '../../domain/usecases/CredentialTypesUseCase';
import { Nullish } from '../../../api/VCLTypes';

export default class CredentialTypesModelImpl implements CredentialTypesModel {
    constructor(
        private readonly credentialTypesUseCase: CredentialTypesUseCase
    ) {}

    data: Nullish<VCLCredentialTypes>;

    async initialize(): Promise<VCLError | null> {
        this.data = await this.credentialTypesUseCase.getCredentialTypes();
        return null;
    }
}
