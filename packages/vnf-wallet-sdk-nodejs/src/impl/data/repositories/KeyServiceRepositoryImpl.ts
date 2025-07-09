import VCLDidJwk from '../../../api/entities/VCLDidJwk';
import VCLDidJwkDescriptor from '../../../api/entities/VCLDidJwkDescriptor';
import VCLKeyService from '../../../api/keys/VCLKeyService';
import KeyServiceRepository from '../../domain/repositories/KeyServiceRepository';

export default class KeyServiceRepositoryImpl implements KeyServiceRepository {
    private keyService: VCLKeyService;

    constructor(keyService: VCLKeyService) {
        this.keyService = keyService;
    }

    async generateDidJwk(
        didJwkDescriptor: VCLDidJwkDescriptor
    ): Promise<VCLDidJwk> {
        return this.keyService.generateDidJwk(didJwkDescriptor);
    }
}
