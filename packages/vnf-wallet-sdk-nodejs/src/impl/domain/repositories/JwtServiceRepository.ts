import VCLDidJwk from '../../../api/entities/VCLDidJwk';
import VCLPublicJwk from '../../../api/entities/VCLPublicJwk';
import VCLJwt from '../../../api/entities/VCLJwt';
import VCLJwtDescriptor from '../../../api/entities/VCLJwtDescriptor';
import { Nullish } from '../../../api/VCLTypes';
import VCLToken from '../../../api/entities/VCLToken';

export default interface JwtServiceRepository {
    decode(encodedJwt: string): Promise<VCLJwt>;

    verifyJwt(
        jwt: VCLJwt,
        publicJwk: Nullish<VCLPublicJwk>,
        remoteCryptoServicesToken: Nullish<VCLToken>
    ): Promise<boolean>;

    generateSignedJwt(
        jwtDescriptor: VCLJwtDescriptor,
        didJwk: VCLDidJwk,
        nonce: Nullish<string>,
        remoteCryptoServicesToken: Nullish<VCLToken>
    ): Promise<VCLJwt>;
}
