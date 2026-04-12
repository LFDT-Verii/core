import {
    Nullish,
    VCLJwt,
    VCLJwtVerifyService,
    VCLPublicJwk,
} from '../../../../src';

export class JwtVerifyServiceMock implements VCLJwtVerifyService {
    async verify(
        _jwt: VCLJwt,
        _publicJwk: Nullish<VCLPublicJwk>,
    ): Promise<boolean> {
        return true;
    }
}
