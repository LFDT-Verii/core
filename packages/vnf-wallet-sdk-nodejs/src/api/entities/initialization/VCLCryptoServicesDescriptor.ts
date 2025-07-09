import VCLJwtSignService from '../../jwt/VCLJwtSignService';
import VCLJwtVerifyService from '../../jwt/VCLJwtVerifyService';
import VCLKeyService from '../../keys/VCLKeyService';
import { ensureDefined } from '../../../impl/utils/HelperFunctions';

export default class VCLCryptoServicesDescriptor {
    public readonly keyService: VCLKeyService;

    public readonly jwtSignService: VCLJwtSignService;

    public readonly jwtVerifyService: VCLJwtVerifyService;

    constructor(
        keyService: VCLKeyService,
        jwtSignService: VCLJwtSignService,
        jwtVerifyService: VCLJwtVerifyService
    ) {
        this.keyService = ensureDefined(keyService, 'keyService');
        this.jwtSignService = ensureDefined(jwtSignService, 'jwtSignService');
        this.jwtVerifyService = ensureDefined(
            jwtVerifyService,
            'jwtVerifyService'
        );
    }
}
