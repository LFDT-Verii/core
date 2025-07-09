class ErrorMocks {
    static Payload =
        '{"error":"Bad Request","errorCode":"proof_jwt_is_required","requestId":"some_request_id","message":"proof.jwt is missing","statusCode":400}';

    static Error = 'Bad Request';

    static ErrorCode = 'proof_jwt_is_required';

    static RequestId = 'some_request_id';

    static Message = 'proof.jwt is missing';

    static StatusCode = 400;

    static SomeErrorJson = {
        error: 'Bad Request',
        message: 'Exchange 668306be0a90a4bff3c4707a is in an invalid state',
        statusCode: 400,
        errorCode: 'exchange_invalid',
        requestId: 'some_request_id',
    };
}

export { ErrorMocks };
