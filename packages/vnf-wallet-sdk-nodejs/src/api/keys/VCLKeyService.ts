import VCLDidJwk from '../entities/VCLDidJwk';
import VCLDidJwkDescriptor from '../entities/VCLDidJwkDescriptor';

export default interface VCLKeyService {
    generateDidJwk(didJwkDescriptor: VCLDidJwkDescriptor): Promise<VCLDidJwk>;
}
