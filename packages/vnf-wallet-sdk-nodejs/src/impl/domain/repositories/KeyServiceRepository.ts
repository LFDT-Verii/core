import VCLDidJwk from '../../../api/entities/VCLDidJwk';
import VCLDidJwkDescriptor from '../../../api/entities/VCLDidJwkDescriptor';

export default interface KeyServiceRepository {
    generateDidJwk(didJwkDescriptor: VCLDidJwkDescriptor): Promise<VCLDidJwk>;
}
