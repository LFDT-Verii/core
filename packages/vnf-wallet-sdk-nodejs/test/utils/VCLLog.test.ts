import VCLLog from '../../src/impl/utils/VCLLog';
import GlobalConfig from '../../src/impl/GlobalConfig';

const mockLoggerService = {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
};

describe('VCLLog', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        VCLLog.setLoggerService(mockLoggerService);
        GlobalConfig.setIsDebugOn(true);
    });

    describe('LoggerService', () => {
        it('should set and get the LoggerService correctly', () => {
            VCLLog.setLoggerService(mockLoggerService);
            expect(VCLLog.LoggerService).toEqual(mockLoggerService);
        });
    });

    describe('error()', () => {
        it('should always call LoggerService.error', () => {
            VCLLog.error({ error: 'obj' }, 'Error message', 'arg1', 'arg2');
            expect(mockLoggerService.error).toHaveBeenCalledTimes(1);
            expect(mockLoggerService.error).toHaveBeenCalledWith(
                { error: 'obj' },
                'Error message',
                'arg1',
                'arg2'
            );
        });
    });

    describe('warn()', () => {
        it('should call LoggerService.warn if IsLoggerOn is true', () => {
            VCLLog.warn({ warn: 'obj' }, 'Warn message', 'arg1', 'arg2');
            expect(mockLoggerService.warn).toHaveBeenCalledTimes(1);
            expect(mockLoggerService.warn).toHaveBeenCalledWith(
                { warn: 'obj' },
                'Warn message',
                'arg1',
                'arg2'
            );
        });

        it('should not call LoggerService.warn if IsLoggerOn is false', () => {
            GlobalConfig.setIsDebugOn(false);
            VCLLog.warn({ warn: 'obj' }, 'Warn message', 'arg1', 'arg2');
            expect(mockLoggerService.warn).not.toHaveBeenCalled();
        });
    });

    describe('info()', () => {
        it('should call LoggerService.info if IsLoggerOn is true', () => {
            VCLLog.info({ info: 'obj' }, 'Info message', 'arg1', 'arg2');
            expect(mockLoggerService.info).toHaveBeenCalledTimes(1);
            expect(mockLoggerService.info).toHaveBeenCalledWith(
                { info: 'obj' },
                'Info message',
                'arg1',
                'arg2'
            );
        });

        it('should not call LoggerService.info if IsLoggerOn is false', () => {
            GlobalConfig.setIsDebugOn(false);
            VCLLog.info({ info: 'obj' }, 'Info message', 'arg1', 'arg2');
            expect(mockLoggerService.info).not.toHaveBeenCalled();
        });
    });
});
