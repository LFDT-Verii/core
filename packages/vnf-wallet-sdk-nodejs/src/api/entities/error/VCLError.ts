import { Dictionary, Nullish } from '../../VCLTypes';
import VCLErrorCode from './VCLErrorCode';

export default class VCLError extends Error {
    payload: Nullish<string> = null;

    error: Nullish<string> = null;

    requestId: Nullish<string> = null;

    errorCode: string = VCLErrorCode.SdkError.toString();

    statusCode: Nullish<number> = null;

    constructor(
        error: Nullish<string> = null,
        errorCode: string = VCLErrorCode.SdkError.toString(),
        requestId: Nullish<string> = null,
        message: Nullish<string> = null,
        statusCode: Nullish<number> = null
    ) {
        super(message ?? '');
        this.error = error;
        this.errorCode = errorCode;
        this.requestId = requestId;
        this.statusCode = statusCode;
        this.payload = JSON.stringify(this.jsonObject);

        this.name = 'VCLError';
        // eslint-disable-next-line better-mutation/no-mutating-functions
        Object.setPrototypeOf(this, new.target.prototype); // restore prototype chain
    }

    static fromPayload(payload: string): VCLError {
        const payloadJson = JSON.parse(payload);
        return VCLError.fromJson(payloadJson);
    }

    static fromJson(payloadJson: Dictionary<any>): VCLError {
        const result = new VCLError(
            payloadJson?.[VCLError.KeyError],
            payloadJson?.[VCLError.KeyErrorCode] ??
                VCLErrorCode.SdkError.toString(),
            payloadJson?.[VCLError.KeyRequestId],
            payloadJson?.[VCLError.KeyMessage],
            payloadJson?.[VCLError.KeyStatusCode]
        );
        result.payload = JSON.stringify(payloadJson);

        return result;
    }

    static fromError(error: any, statusCode: Nullish<number> = null): VCLError {
        if (error instanceof VCLError) {
            return error;
        }
        return new VCLError(
            JSON.stringify(error),
            VCLError.findErrorCode(error),
            error.requestId,
            error.message,
            statusCode ?? error.statusCode
        );
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
