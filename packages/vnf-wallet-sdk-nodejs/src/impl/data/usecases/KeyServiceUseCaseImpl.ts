import VCLDidJwk from '../../../api/entities/VCLDidJwk';
import VCLDidJwkDescriptor from '../../../api/entities/VCLDidJwkDescriptor';
import KeyServiceRepository from '../../domain/repositories/KeyServiceRepository';
import KeyServiceUseCase from '../../domain/usecases/KeyServiceUseCase';
import VCLError from '../../../api/entities/error/VCLError';

export default class KeyServiceUseCaseImpl implements KeyServiceUseCase {
    constructor(private readonly keyServiceRepository: KeyServiceRepository) {}

    async generateDidJwk(
        didJwkDescriptor: VCLDidJwkDescriptor
    ): Promise<VCLDidJwk> {
        try {
            return await this.keyServiceRepository.generateDidJwk(
                didJwkDescriptor
            );
        } catch (error: any) {
            throw VCLError.fromError(error);
        }
    }
}
