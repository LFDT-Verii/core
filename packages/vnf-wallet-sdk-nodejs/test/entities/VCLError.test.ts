import VCLError from '../../src/api/entities/error/VCLError';
import { ErrorMocks } from '../infrastructure/resources/valid/ErrorMocks';

describe('VCLError Tests', () => {
    test('testErrorFromPayload', () => {
        const error = VCLError.fromPayload(ErrorMocks.Payload);

        expect(error.payload).toEqual(ErrorMocks.Payload);
        expect(error.error).toEqual(ErrorMocks.Error);
        expect(error.errorCode).toEqual(ErrorMocks.ErrorCode);
        expect(error.message).toEqual(ErrorMocks.Message);
        expect(error.statusCode).toEqual(ErrorMocks.StatusCode);
    });

    test('testErrorFromProperties', () => {
        const error = new VCLError(
            ErrorMocks.Error,
            ErrorMocks.ErrorCode,
            ErrorMocks.RequestId,
            ErrorMocks.Message,
            ErrorMocks.StatusCode
        );

        expect(error.error).toEqual(ErrorMocks.Error);
        expect(error.errorCode).toEqual(ErrorMocks.ErrorCode);
        expect(error.requestId).toEqual(ErrorMocks.RequestId);
        expect(error.message).toEqual(ErrorMocks.Message);
        expect(error.statusCode).toEqual(ErrorMocks.StatusCode);
    });

    test('testErrorToJsonFromPayload', () => {
        const error = VCLError.fromPayload(ErrorMocks.Payload);
        const errorJsonObject = error.jsonObject;

        expect(errorJsonObject[VCLError.KeyPayload]).toEqual(
            ErrorMocks.Payload
        );
        expect(errorJsonObject[VCLError.KeyError]).toEqual(ErrorMocks.Error);
        expect(errorJsonObject[VCLError.KeyErrorCode]).toEqual(
            ErrorMocks.ErrorCode
        );
        expect(errorJsonObject[VCLError.KeyRequestId]).toEqual(
            ErrorMocks.RequestId
        );
        expect(errorJsonObject[VCLError.KeyMessage]).toEqual(
            ErrorMocks.Message
        );
        expect(errorJsonObject[VCLError.KeyStatusCode]).toEqual(
            ErrorMocks.StatusCode
        );
    });

    test('testErrorToJsonFromProperties', () => {
        const error = new VCLError(
            ErrorMocks.Error,
            ErrorMocks.ErrorCode,
            ErrorMocks.RequestId,
            ErrorMocks.Message,
            ErrorMocks.StatusCode
        );
        const errorJsonObject = error.jsonObject;

        expect(errorJsonObject[VCLError.KeyError]).toEqual(ErrorMocks.Error);
        expect(errorJsonObject[VCLError.KeyErrorCode]).toEqual(
            ErrorMocks.ErrorCode
        );
        expect(errorJsonObject[VCLError.KeyRequestId]).toEqual(
            ErrorMocks.RequestId
        );
        expect(errorJsonObject[VCLError.KeyMessage]).toEqual(
            ErrorMocks.Message
        );
        expect(errorJsonObject[VCLError.KeyStatusCode]).toEqual(
            ErrorMocks.StatusCode
        );
    });

    test('testErrorFromSomeError', () => {
        const error = VCLError.fromJson(ErrorMocks.SomeErrorJson);

        expect(JSON.parse(error.payload ?? '{}')).toStrictEqual(
            ErrorMocks.SomeErrorJson
        );
        expect(error.error).toEqual(ErrorMocks.SomeErrorJson.error);
        expect(error.errorCode).toEqual(ErrorMocks.SomeErrorJson.errorCode);
        expect(error.requestId).toEqual(ErrorMocks.SomeErrorJson.requestId);
        expect(error.message).toEqual(ErrorMocks.SomeErrorJson.message);
        expect(error.statusCode).toEqual(ErrorMocks.SomeErrorJson.statusCode);
    });
});
