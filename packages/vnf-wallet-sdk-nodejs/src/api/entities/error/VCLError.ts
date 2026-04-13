import { Dictionary, Nullish } from '../../VCLTypes';
import VCLErrorCode from './VCLErrorCode';

export type VCLErrorArgs = {
    payload?: Nullish<string>;
    error?: Nullish<string>;
    errorCode?: string;
    requestId?: Nullish<string>;
    message?: Nullish<string>;
    statusCode?: Nullish<number>;
};

export default class VCLError extends Error {
    payload: Nullish<string> = null;

    error: Nullish<string> = null;

    requestId: Nullish<string> = null;

    errorCode: string = VCLErrorCode.SdkError.toString();

    statusCode: Nullish<number> = null;

    // eslint-disable-next-line complexity
    constructor({
        payload = null,
        error = null,
        errorCode = VCLErrorCode.SdkError.toString(),
        requestId = null,
        message = null,
        statusCode = null,
    }: VCLErrorArgs = {}) {
        super(message ?? '');
        this.payload = payload;
        this.error = error;
        this.errorCode = errorCode;
        this.requestId = requestId;
        this.statusCode = statusCode;

        this.name = 'VCLError';
        // eslint-disable-next-line better-mutation/no-mutating-functions
        Object.setPrototypeOf(this, new.target.prototype); // restore prototype chain
    }

    // eslint-disable-next-line complexity
    static fromPayload(payload: string): VCLError {
        const payloadJson = JSON.parse(payload);
        return new VCLError({
            payload,
            error: payloadJson?.[VCLError.KeyError],
            errorCode:
                payloadJson?.[VCLError.KeyErrorCode] ??
                VCLErrorCode.SdkError.toString(),
            requestId: payloadJson?.[VCLError.KeyRequestId],
            message: payloadJson?.[VCLError.KeyMessage],
            statusCode: payloadJson?.[VCLError.KeyStatusCode],
        });
    }

    static fromError(error: any, statusCode: Nullish<number> = null): VCLError {
        if (error instanceof VCLError) {
            return error;
        }
        return new VCLError({
            error: JSON.stringify(error),
            errorCode: VCLError.findErrorCode(error),
            requestId: error.requestId,
            message: error.message,
            statusCode: statusCode ?? error.statusCode,
        });
    }

    private static findErrorCode(error: any): string {
        if (error) {
            if (error.errorCode) {
                return error.errorCode;
            }
            if (Object.values(VCLErrorCode).includes(error.message)) {
                return error.message;
            }
        }
        return VCLErrorCode.SdkError;
    }

    get jsonObject(): Dictionary<any> {
        return {
            [VCLError.KeyPayload]: this.payload,
            [VCLError.KeyError]: this.error,
            [VCLError.KeyRequestId]: this.requestId,
            [VCLError.KeyErrorCode]:
                this.errorCode ?? VCLErrorCode.SdkError.toString(),
            [VCLError.KeyMessage]: this.message,
            [VCLError.KeyStatusCode]: this.statusCode,
        };
    }

    static readonly KeyPayload: string = 'payload';

    static readonly KeyError: string = 'error';

    static readonly KeyErrorCode: string = 'errorCode';

    static readonly KeyRequestId: string = 'requestId';

    static readonly KeyMessage: string = 'message';

    static readonly KeyStatusCode: string = 'statusCode';
}
