import { describe, test } from 'node:test';
import { expect } from 'expect';
import VCLError from '../../src/api/entities/error/VCLError';
import { ErrorMocks } from '../infrastructure/resources/valid/ErrorMocks';

describe('VCLError', () => {
    test('creates an error from a payload', () => {
        const error = VCLError.fromPayload(ErrorMocks.Payload);

        expect(error.payload).toEqual(ErrorMocks.Payload);
        expect(error.error).toEqual(ErrorMocks.Error);
        expect(error.errorCode).toEqual(ErrorMocks.ErrorCode);
        expect(error.message).toEqual(ErrorMocks.Message);
        expect(error.statusCode).toEqual(ErrorMocks.StatusCode);
    });

    test('creates an error from explicit properties', () => {
        const error = new VCLError({
            error: ErrorMocks.Error,
            errorCode: ErrorMocks.ErrorCode,
            requestId: ErrorMocks.RequestId,
            message: ErrorMocks.Message,
            statusCode: ErrorMocks.StatusCode,
        });

        expect(error.error).toEqual(ErrorMocks.Error);
        expect(error.errorCode).toEqual(ErrorMocks.ErrorCode);
        expect(error.requestId).toEqual(ErrorMocks.RequestId);
        expect(error.message).toEqual(ErrorMocks.Message);
        expect(error.statusCode).toEqual(ErrorMocks.StatusCode);
    });

    test('creates an error from a human-readable message', () => {
        const error = new VCLError({ message: 'Readable error' });

        expect(error.payload).toBeNull();
        expect(error.error).toBeNull();
        expect(error.message).toEqual('Readable error');
        expect(error.requestId).toBeNull();
        expect(error.statusCode).toBeNull();
    });

    test('serializes an error created from a payload', () => {
        const error = VCLError.fromPayload(ErrorMocks.Payload);
        const errorJsonObject = error.jsonObject;

        expect(errorJsonObject[VCLError.KeyPayload]).toEqual(
            ErrorMocks.Payload,
        );
        expect(errorJsonObject[VCLError.KeyError]).toEqual(ErrorMocks.Error);
        expect(errorJsonObject[VCLError.KeyErrorCode]).toEqual(
            ErrorMocks.ErrorCode,
        );
        expect(errorJsonObject[VCLError.KeyRequestId]).toEqual(
            ErrorMocks.RequestId,
        );
        expect(errorJsonObject[VCLError.KeyMessage]).toEqual(
            ErrorMocks.Message,
        );
        expect(errorJsonObject[VCLError.KeyStatusCode]).toEqual(
            ErrorMocks.StatusCode,
        );
    });

    test('serializes an error created from explicit properties', () => {
        const error = new VCLError({
            error: ErrorMocks.Error,
            errorCode: ErrorMocks.ErrorCode,
            requestId: ErrorMocks.RequestId,
            message: ErrorMocks.Message,
            statusCode: ErrorMocks.StatusCode,
        });
        const errorJsonObject = error.jsonObject;

        expect(errorJsonObject[VCLError.KeyPayload]).toBeNull();
        expect(errorJsonObject[VCLError.KeyError]).toEqual(ErrorMocks.Error);
        expect(errorJsonObject[VCLError.KeyErrorCode]).toEqual(
            ErrorMocks.ErrorCode,
        );
        expect(errorJsonObject[VCLError.KeyRequestId]).toEqual(
            ErrorMocks.RequestId,
        );
        expect(errorJsonObject[VCLError.KeyMessage]).toEqual(
            ErrorMocks.Message,
        );
        expect(errorJsonObject[VCLError.KeyStatusCode]).toEqual(
            ErrorMocks.StatusCode,
        );
    });

    test('creates an error from another error', () => {
        const sourceError = {
            error: ErrorMocks.SomeErrorJson.error,
            errorCode: ErrorMocks.SomeErrorJson.errorCode,
            requestId: ErrorMocks.SomeErrorJson.requestId,
            message: ErrorMocks.SomeErrorJson.message,
            statusCode: ErrorMocks.SomeErrorJson.statusCode,
        };
        const error = VCLError.fromError(sourceError);

        expect(error.payload).toBeNull();
        expect(error.error).toEqual(JSON.stringify(sourceError));
        expect(error.errorCode).toEqual(ErrorMocks.SomeErrorJson.errorCode);
        expect(error.requestId).toEqual(ErrorMocks.SomeErrorJson.requestId);
        expect(error.message).toEqual(ErrorMocks.SomeErrorJson.message);
        expect(error.statusCode).toEqual(ErrorMocks.SomeErrorJson.statusCode);
    });
});
