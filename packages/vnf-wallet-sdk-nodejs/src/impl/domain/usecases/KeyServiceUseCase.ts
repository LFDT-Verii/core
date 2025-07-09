import VCLDidJwk from '../../../api/entities/VCLDidJwk';
import VCLDidJwkDescriptor from '../../../api/entities/VCLDidJwkDescriptor';

export default interface KeyServiceUseCase {
    generateDidJwk(didJwkDescriptor: VCLDidJwkDescriptor): Promise<VCLDidJwk>;
}
