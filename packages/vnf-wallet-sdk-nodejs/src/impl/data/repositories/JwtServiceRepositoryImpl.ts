import VCLDidJwk from '../../../api/entities/VCLDidJwk';
import VCLPublicJwk from '../../../api/entities/VCLPublicJwk';
import VCLJwt from '../../../api/entities/VCLJwt';
import VCLJwtDescriptor from '../../../api/entities/VCLJwtDescriptor';
import JwtServiceRepository from '../../domain/repositories/JwtServiceRepository';
import VCLJwtSignService from '../../../api/jwt/VCLJwtSignService';
import VCLJwtVerifyService from '../../../api/jwt/VCLJwtVerifyService';
import { Nullish } from '../../../api/VCLTypes';
import VCLToken from '../../../api/entities/VCLToken';

export default class JwtServiceRepositoryImpl implements JwtServiceRepository {
    constructor(
        private readonly jwtSignService: VCLJwtSignService,
        private readonly jwtVerifyService: VCLJwtVerifyService
    ) {}

    async decode(encodedJwt: string): Promise<VCLJwt> {
        return VCLJwt.fromEncodedJwt(encodedJwt);
    }

    async verifyJwt(
        jwt: VCLJwt,
        publicJwk: Nullish<VCLPublicJwk>,
        remoteCryptoServicesToken: Nullish<VCLToken>
    ): Promise<boolean> {
        return this.jwtVerifyService.verify(
            jwt,
            publicJwk,
            remoteCryptoServicesToken
        );
    }

    async generateSignedJwt(
        jwtDescriptor: VCLJwtDescriptor,
        didJwk: VCLDidJwk,
        nonce: Nullish<string>,
        remoteCryptoServicesToken: Nullish<VCLToken>
    ): Promise<VCLJwt> {
        return this.jwtSignService.sign(
            jwtDescriptor,
            didJwk,
            nonce,
            remoteCryptoServicesToken
        );
    }
}
