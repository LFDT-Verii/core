import pino from 'pino';
import {
    VCLLogService,
    LogFn,
} from '../../api/entities/initialization/VCLLogService';
import GlobalConfig from '../GlobalConfig';

export default class VCLLog {
    private static _LoggerService: VCLLogService = pino();

    static get LoggerService(): VCLLogService {
        return this._LoggerService;
    }

    static setLoggerService(value: VCLLogService) {
        this._LoggerService = value || pino();
    }

    static error: LogFn = (obj: any, msg?: string, ...args: any[]) => {
        // always log errors
        this.LoggerService.error(obj, msg, ...args);
    };

    static warn: LogFn = (obj: any, msg?: string, ...args: any[]) => {
        // eslint-disable-next-line no-unused-expressions
        GlobalConfig.IsLoggerOn && this.LoggerService.warn(obj, msg, ...args);
    };

    static info: LogFn = (obj: any, msg?: string, ...args: any[]) => {
        // eslint-disable-next-line no-unused-expressions
        GlobalConfig.IsLoggerOn && this.LoggerService.info(obj, msg, ...args);
    };
}
