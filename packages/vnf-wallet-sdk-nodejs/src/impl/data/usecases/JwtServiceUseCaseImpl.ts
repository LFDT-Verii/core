import VCLDidJwk from '../../../api/entities/VCLDidJwk';
import VCLPublicJwk from '../../../api/entities/VCLPublicJwk';
import VCLJwt from '../../../api/entities/VCLJwt';
import VCLJwtDescriptor from '../../../api/entities/VCLJwtDescriptor';
import JwtServiceRepository from '../../domain/repositories/JwtServiceRepository';
import JwtServiceUseCase from '../../domain/usecases/JwtServiceUseCase';
import { Nullish } from '../../../api/VCLTypes';
import VCLToken from '../../../api/entities/VCLToken';
import VCLError from '../../../api/entities/error/VCLError';

export default class JwtServiceUseCaseImpl implements JwtServiceUseCase {
    constructor(private readonly jwtServiceRepository: JwtServiceRepository) {}

    async verifyJwt(
        jwt: VCLJwt,
        publicJwk: Nullish<VCLPublicJwk>,
        remoteCryptoServicesToken: Nullish<VCLToken>
    ) {
        try {
            return await this.jwtServiceRepository.verifyJwt(
                jwt,
                publicJwk,
                remoteCryptoServicesToken
            );
        } catch (error: any) {
            throw VCLError.fromError(error);
        }
    }

    async generateSignedJwt(
        jwtDescriptor: VCLJwtDescriptor,
        didJwk: VCLDidJwk,
        nonce: Nullish<string>,
        remoteCryptoServicesToken: Nullish<VCLToken>
    ): Promise<VCLJwt> {
        return this.jwtServiceRepository.generateSignedJwt(
            jwtDescriptor,
            didJwk,
            nonce,
            remoteCryptoServicesToken
        );
    }
}
