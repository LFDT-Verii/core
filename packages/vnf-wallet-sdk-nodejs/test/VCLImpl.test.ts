import { beforeEach, describe, test, mock } from 'node:test';
import { expect } from 'expect';
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
        generateDidJwk: mock.fn(),
    },
    jwtSignService: {
        sign: mock.fn(),
    },
    jwtVerifyService: {
        verify: mock.fn(),
    },
};

describe('VCLImpl - initGlobalConfigurations()', () => {
    let vclImpl: VCLImpl;

    const mockLogService = {
        info: mock.fn(),
        warn: mock.fn(),
        error: mock.fn(),
    };
    const mockGlobalConfigInit = mock.fn();

    beforeEach(() => {
        vclImpl = new VCLImpl();

        GlobalConfig.init = mockGlobalConfigInit;
        mockGlobalConfigInit.mock.resetCalls();
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

        expect(mockGlobalConfigInit.mock.callCount()).toEqual(1);
        expect(mockGlobalConfigInit.mock.calls[0].arguments).toEqual([
            initializationDescriptor.isDebugOn,
            initializationDescriptor.environment,
            initializationDescriptor.xVnfProtocolVersion,
            true,
        ]);
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
