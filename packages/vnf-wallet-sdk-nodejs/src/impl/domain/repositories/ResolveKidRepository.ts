import VCLPublicJwk from '../../../api/entities/VCLPublicJwk';

export default interface ResolveKidRepository {
    getPublicKey(kid: string): Promise<VCLPublicJwk>;
}
