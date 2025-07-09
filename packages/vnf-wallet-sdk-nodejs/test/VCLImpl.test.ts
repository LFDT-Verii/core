import { VCLImpl } from '../src/impl/VCLImpl';
import GlobalConfig from '../src/impl/GlobalConfig';
import VCLLog from '../src/impl/utils/VCLLog';
import {
    VCLEnvironment,
    VCLInitializationDescriptor,
    VCLXVnfProtocolVersion,
} from '../src';

const mockCryptoServicesDescriptor = {
    keyService: {
        generateDidJwk: jest.fn(),
    },
    jwtSignService: {
        sign: jest.fn(),
    },
    jwtVerifyService: {
        verify: jest.fn(),
    },
};

describe('VCLImpl - initGlobalConfigurations()', () => {
    let vclImpl: VCLImpl;

    const mockLogService = {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
    };
    const mockGlobalConfigInit = jest.fn();

    beforeEach(() => {
        vclImpl = new VCLImpl();

        GlobalConfig.init = mockGlobalConfigInit;
        mockGlobalConfigInit.mockClear();
    });

    test('should call GlobalConfig.init with correct parameters', () => {
        const initializationDescriptor = new VCLInitializationDescriptor(
            VCLEnvironment.Prod,
            VCLXVnfProtocolVersion.XVnfProtocolVersion1,
            mockCryptoServicesDescriptor,
            false,
            mockLogService
        );

        vclImpl.initGlobalConfigurations(initializationDescriptor);

        expect(mockGlobalConfigInit).toHaveBeenCalledTimes(1);
        expect(mockGlobalConfigInit).toHaveBeenCalledWith(
            initializationDescriptor.isDebugOn,
            initializationDescriptor.environment,
            initializationDescriptor.xVnfProtocolVersion,
            true
        );
    });

    test('should assign VCLLog.LoggerService to the provided log service', () => {
        const initializationDescriptor = new VCLInitializationDescriptor(
            VCLEnvironment.Staging,
            VCLXVnfProtocolVersion.XVnfProtocolVersion2,
            mockCryptoServicesDescriptor,
            false,
            mockLogService
        );

        vclImpl.initGlobalConfigurations(initializationDescriptor);

        expect(VCLLog.LoggerService).toEqual(
            initializationDescriptor.logService
        );
    });
});
