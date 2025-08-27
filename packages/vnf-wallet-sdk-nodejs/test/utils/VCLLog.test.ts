import { beforeEach, describe, it, mock } from 'node:test';
import { expect } from 'expect';
import VCLLog from '../../src/impl/utils/VCLLog';
import GlobalConfig from '../../src/impl/GlobalConfig';

const mockLoggerService = {
    error: mock.fn(),
    warn: mock.fn(),
    info: mock.fn(),
};

describe('VCLLog', () => {
    beforeEach(() => {
        mockLoggerService.error.mock.resetCalls();
        mockLoggerService.warn.mock.resetCalls();
        mockLoggerService.info.mock.resetCalls();
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
            expect(mockLoggerService.error.mock.callCount()).toEqual(1);
            expect(mockLoggerService.error.mock.calls[0].arguments).toEqual([
                { error: 'obj' },
                'Error message',
                'arg1',
                'arg2',
            ]);
        });
    });

    describe('warn()', () => {
        it('should call LoggerService.warn if IsLoggerOn is true', () => {
            VCLLog.warn({ warn: 'obj' }, 'Warn message', 'arg1', 'arg2');
            expect(mockLoggerService.warn.mock.callCount()).toEqual(1);
            expect(mockLoggerService.warn.mock.calls[0].arguments).toEqual([
                { warn: 'obj' },
                'Warn message',
                'arg1',
                'arg2',
            ]);
        });

        it('should not call LoggerService.warn if IsLoggerOn is false', () => {
            GlobalConfig.setIsDebugOn(false);
            VCLLog.warn({ warn: 'obj' }, 'Warn message', 'arg1', 'arg2');
            expect(mockLoggerService.warn.mock.callCount()).toEqual(0);
        });
    });

    describe('info()', () => {
        it('should call LoggerService.info if IsLoggerOn is true', () => {
            VCLLog.info({ info: 'obj' }, 'Info message', 'arg1', 'arg2');
            expect(mockLoggerService.info.mock.callCount()).toEqual(1);
            expect(mockLoggerService.info.mock.calls[0].arguments).toEqual([
                { info: 'obj' },
                'Info message',
                'arg1',
                'arg2',
            ]);
        });

        it('should not call LoggerService.info if IsLoggerOn is false', () => {
            GlobalConfig.setIsDebugOn(false);
            VCLLog.info({ info: 'obj' }, 'Info message', 'arg1', 'arg2');
            expect(mockLoggerService.info.mock.callCount()).toEqual(0);
        });
    });
});
