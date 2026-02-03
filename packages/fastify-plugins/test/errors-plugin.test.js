/**
 * Copyright 2023 Velocity Team
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
const { beforeEach, describe, it, mock } = require('node:test');
const { expect } = require('expect');

const {
  addValidationErrorCode,
  ensureErrorCode,
  extractRequestPath,
  getDocsUrl,
  errorsPlugin,
  addRequestId,
} = require('../src/errors-plugin');
const { ERROR_CODES } = require('../src/constants');

const IdentifyEndpoint = '/issuing/identify';
const GenerateOffersEndpoint = '/issuing/generate-offers';

const endpointDocsMap = {
  [IdentifyEndpoint]:
    'https://docs.velocitycareerlabs.io/#/./Issuing?id=step-2-identify-a-person',
  [GenerateOffersEndpoint]:
    'https://docs.velocitycareerlabs.io/#/./Issuing?id=step-3-generate-credential-offers',
};

describe('Error Handling', () => {
  it('Should return request path from URL', () => {
    const url = 'http://some-host/enpoint/path?param=value';

    const result = extractRequestPath(url);

    expect(result).toEqual('/enpoint/path');
  });

  it('Should return identify endpoint documentation URL', () => {
    const url = 'http://some-host/issuing/identify?param=value';

    const result = getDocsUrl(url, {
      endpointDocsMap,
    });

    expect(result).toEqual(
      'https://docs.velocitycareerlabs.io/#/./Issuing?id=step-2-identify-a-person',
    );
  });

  it('Should return generate offers endpoint documentation URL', () => {
    const url = 'http://some-host/issuing/generate-offers?param=value';

    const result = getDocsUrl(url, {
      endpointDocsMap,
    });

    expect(result).toEqual(
      'https://docs.velocitycareerlabs.io/#/./Issuing?id=step-3-generate-credential-offers',
    );
  });

  it('Should return empty url when endpointDocsMap is empty', () => {
    const url = 'http://some-host/issuing/generate-offers?param=value';

    const result = getDocsUrl(url);

    expect(result).toBeUndefined();
  });

  it('Should get error with error code if not exist', () => {
    const error = { statusCode: 400, message: 'SOME-ERROR-MESSAGE' };
    const mockLog = mock.fn();
    const context = {
      log: {
        error: mockLog,
      },
    };

    expect(ensureErrorCode(error, context)).toEqual({
      ...error,
      errorCode: ERROR_CODES.MISSING_ERROR_CODE,
    });
    expect(mockLog.mock.callCount()).toEqual(1);
  });

  it('Should return error with error code', () => {
    const error = {
      statusCode: 400,
      message: 'SOME-ERROR-MESSAGE',
      errorCode: 'abc_code',
    };
    const mockLog = mock.fn();
    const context = {
      log: {
        error: mockLog,
      },
    };

    expect(ensureErrorCode(error, context)).toEqual(error);
    expect(mockLog.mock.callCount()).toEqual(0);
  });

  it('Should add error code related to validation if validation is present on error', () => {
    const error = {
      statusCode: 400,
      message: 'SOME-ERROR-MESSAGE',
      validation: 'foo',
    };
    const result = addValidationErrorCode(error);
    expect(result).toEqual({
      ...error,
      errorCode: 'request_validation_failed',
    });
  });
  it('Should add requestId if available on request context', () => {
    const requestContext = {
      id: 'fooReqId',
    };
    const error = {
      statusCode: 400,
      message: 'SOME-ERROR-MESSAGE',
    };
    const result = addRequestId(error, requestContext);
    expect(result).toEqual({
      ...error,
      requestId: 'fooReqId',
    });
  });
  it('Should not add requestId if not available on request context', () => {
    const requestContext = {
      notId: 'fooReqId',
    };
    const error = {
      statusCode: 400,
      message: 'SOME-ERROR-MESSAGE',
    };
    const result = addRequestId(error, requestContext);
    expect(result).toEqual({
      ...error,
    });
  });

  describe('Error plugin tests', () => {
    const fakeSetErrorHandler = mock.fn();
    const fakeSendError = mock.fn();
    const fakeLogError = mock.fn();
    let fakeServer;
    let fakeReply;
    let preHandlerFunc;

    beforeEach(() => {
      fakeServer = {
        setErrorHandler: fakeSetErrorHandler,
        log: {
          error: fakeLogError,
        },
      };
      fakeReply = {
        send: fakeSendError,
      };
      errorsPlugin(fakeServer, {}, () => {});
      preHandlerFunc = fakeServer.setErrorHandler.mock.calls[0].arguments[0];
    });

    it('should throw error', () => {
      preHandlerFunc({ message: 'error message' }, {}, fakeReply);
      expect(fakeSendError.mock.callCount()).toEqual(1);
      expect(
        fakeSendError.mock.calls.map((call) => call.arguments),
      ).toContainEqual([
        {
          message: 'error message',
          errorCode: ERROR_CODES.MISSING_ERROR_CODE,
        },
      ]);
      expect(fakeLogError.mock.callCount()).toEqual(1);
      expect(
        fakeLogError.mock.calls.map((call) => call.arguments),
      ).toContainEqual([
        {
          err: {
            errorCode: ERROR_CODES.MISSING_ERROR_CODE,
            message: 'error message',
          },
          message:
            'Error code missing. Please open a ticket with Velocity Network Foundation',
        },
      ]);
    });
  });
});
