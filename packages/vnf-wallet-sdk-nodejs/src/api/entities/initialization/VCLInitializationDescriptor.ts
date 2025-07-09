import pino from 'pino';
import VCLEnvironment from '../../VCLEnvironment';
import VCLCryptoServicesDescriptor from './VCLCryptoServicesDescriptor';
import VCLXVnfProtocolVersion from '../../VCLXVnfProtocolVersion';
import { VCLLogService } from './VCLLogService';

export default class VCLInitializationDescriptor {
    constructor(
        public readonly environment: VCLEnvironment = VCLEnvironment.Prod,
        public readonly xVnfProtocolVersion: VCLXVnfProtocolVersion = VCLXVnfProtocolVersion.XVnfProtocolVersion1,
        public readonly cryptoServicesDescriptor: VCLCryptoServicesDescriptor,
        public readonly isDebugOn: boolean = false,
        public readonly logService: VCLLogService = pino()
    ) {}
}
