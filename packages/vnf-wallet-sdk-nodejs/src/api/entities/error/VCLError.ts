import { Dictionary, Nullish } from '../../VCLTypes';
import VCLErrorCode from './VCLErrorCode';

export type VCLErrorArgs = {
    payload?: Nullish<string>;
    error?: Nullish<string>;
    errorCode?: string;
    requestId?: Nullish<string>;
    message?: Nullish<string>;
    statusCode?: Nullish<number>;
    sourceErrorCode?: Nullish<string>;
    validationPhase?: Nullish<string>;
    requestDid?: Nullish<string>;
    requestUri?: Nullish<string>;
    requestKind?: Nullish<string>;
};

type VCLKnownErrorFields = Error & {
    errorCode?: string;
    requestId?: Nullish<string>;
    statusCode?: Nullish<number>;
};

export default class VCLError extends Error {
    payload: Nullish<string> = null;

    error: Nullish<string> = null;

    requestId: Nullish<string> = null;

    errorCode: string = VCLErrorCode.SdkError.toString();

    statusCode: Nullish<number> = null;

    sourceErrorCode: Nullish<string> = null;

    validationPhase: Nullish<string> = null;

    requestDid: Nullish<string> = null;

    requestUri: Nullish<string> = null;

    requestKind: Nullish<string> = null;

    // eslint-disable-next-line complexity
    constructor({
        payload = null,
        error = null,
        errorCode = VCLErrorCode.SdkError.toString(),
        requestId = null,
        message = null,
        statusCode = null,
        sourceErrorCode = null,
        validationPhase = null,
        requestDid = null,
        requestUri = null,
        requestKind = null,
    }: VCLErrorArgs = {}) {
        super(message ?? '');
        this.payload = payload;
        this.error = error;
        this.errorCode = errorCode;
        this.requestId = requestId;
        this.statusCode = statusCode;
        this.sourceErrorCode = sourceErrorCode;
        this.validationPhase = validationPhase;
        this.requestDid = requestDid;
        this.requestUri = requestUri;
        this.requestKind = requestKind;

        this.name = 'VCLError';
        // eslint-disable-next-line better-mutation/no-mutating-functions
        Object.setPrototypeOf(this, new.target.prototype); // restore prototype chain
    }

    // eslint-disable-next-line complexity
    static fromPayloadJson(payloadJson: Dictionary<any>): VCLError {
        return new VCLError({
            payload: JSON.stringify(payloadJson),
            error: payloadJson?.[VCLError.KeyError],
            errorCode:
                payloadJson?.[VCLError.KeyErrorCode] ??
                VCLErrorCode.SdkError.toString(),
            requestId: payloadJson?.[VCLError.KeyRequestId],
            message: payloadJson?.[VCLError.KeyMessage],
            statusCode: payloadJson?.[VCLError.KeyStatusCode],
            sourceErrorCode: payloadJson?.[VCLError.KeySourceErrorCode],
            validationPhase: payloadJson?.[VCLError.KeyValidationPhase],
            requestDid: payloadJson?.[VCLError.KeyRequestDid],
            requestUri: payloadJson?.[VCLError.KeyRequestUri],
            requestKind: payloadJson?.[VCLError.KeyRequestKind],
        });
    }

    // eslint-disable-next-line complexity
    static fromError(error: any, statusCode: Nullish<number> = null): VCLError {
        if (error instanceof VCLError) {
            return error;
        }

        const knownError = VCLError.asKnownError(error);

        if (knownError == null) {
            return new VCLError({
                error: VCLError.stringifyErrorSafely(error),
                statusCode,
            });
        }

        return new VCLError({
            error: VCLError.stringifyErrorSafely(knownError),
            errorCode: VCLError.findErrorCode(knownError),
            requestId: knownError.requestId ?? null,
            message: knownError.message,
            statusCode: statusCode ?? knownError.statusCode ?? null,
        });
    }

    private static stringifyErrorSafely(error: any): Nullish<string> {
        if (error == null) {
            return null;
        }

        try {
            return JSON.stringify(error);
        } catch {
            return String(error);
        }
    }

    private static asKnownError(error: any): VCLKnownErrorFields | null {
        return error instanceof Error ? (error as VCLKnownErrorFields) : null;
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
        const result: Dictionary<any> = {
            [VCLError.KeyPayload]: this.payload,
            [VCLError.KeyError]: this.error,
            [VCLError.KeyRequestId]: this.requestId,
            [VCLError.KeyErrorCode]:
                this.errorCode ?? VCLErrorCode.SdkError.toString(),
            [VCLError.KeyMessage]: this.message,
            [VCLError.KeyStatusCode]: this.statusCode,
        };
        addOptional(result, VCLError.KeySourceErrorCode, this.sourceErrorCode);
        addOptional(result, VCLError.KeyValidationPhase, this.validationPhase);
        addOptional(result, VCLError.KeyRequestDid, this.requestDid);
        addOptional(result, VCLError.KeyRequestUri, this.requestUri);
        addOptional(result, VCLError.KeyRequestKind, this.requestKind);
        return result;
    }

    static readonly KeyPayload: string = 'payload';

    static readonly KeyError: string = 'error';

    static readonly KeyErrorCode: string = 'errorCode';

    static readonly KeyRequestId: string = 'requestId';

    static readonly KeyMessage: string = 'message';

    static readonly KeyStatusCode: string = 'statusCode';

    static readonly KeySourceErrorCode: string = 'sourceErrorCode';

    static readonly KeyValidationPhase: string = 'validationPhase';

    static readonly KeyRequestDid: string = 'requestDid';

    static readonly KeyRequestUri: string = 'requestUri';

    static readonly KeyRequestKind: string = 'requestKind';
}

const addOptional = (
    target: Dictionary<any>,
    key: string,
    value: Nullish<string>,
) => {
    if (value != null) {
        // eslint-disable-next-line better-mutation/no-mutation
        target[key] = value;
    }
};
