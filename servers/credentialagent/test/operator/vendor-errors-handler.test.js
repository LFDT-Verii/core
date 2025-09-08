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

const { describe, it } = require('node:test');
const { expect } = require('expect');
const newError = require('http-errors');

const { handleVendorError } = require('../../src/fetchers/operator/vendor-errors-handler');

describe('Vendor Errors Handler', () => {
  it('Should throw BadGateway when error message includes "getaddrinfo"', () => {
    const error = {
      message: 'TEXT getaddrinfo TEXT',
      url: 'SOME-URL-PATH',
    };

    const result = () => handleVendorError(error);

    expect(result).toThrow(
      new newError.BadRequest(
        'DNS Error - Please verify that that the server has access to an internal DNS server, and that the vendor gateway api has an entry'
      )
    );
  });

  it('Should throw BadGateway when error message includes "ETIMEDOUT"', () => {
    const error = {
      message: 'TEXT ETIMEDOUT TEXT',
      url: 'SOME-URL-PATH',
    };

    const result = () => handleVendorError(error);

    expect(result).toThrow(
      new newError.BadGateway(
        'Connectivity Error - Unable to connect to the vendor gateway. Please check routing tables and firewall settings'
      )
    );
  });

  it('Should throw BadGateway when error message includes "EPIPE"', () => {
    const error = {
      message: 'TEXT EPIPE TEXT',
      url: 'SOME-URL-PATH',
    };

    const result = () => handleVendorError(error);

    expect(result).toThrow(
      new newError.BadGateway(
        'Connectivity Error - Unable to connect to the vendor gateway. Please check routing tables and firewall settings'
      )
    );
  });

  it('Should throw BadGateway when error message includes "ECONNRESET"', () => {
    const error = {
      message: 'TEXT ECONNRESET TEXT',
      url: 'SOME-URL-PATH',
    };

    const result = () => handleVendorError(error);

    expect(result).toThrow(
      new newError.BadGateway(
        'Connectivity Error - Unable to connect to the vendor gateway. Please check routing tables and firewall settings'
      )
    );
  });

  it('Should throw BadGateway when error message includes "ECONNREFUSED"', () => {
    const error = {
      message: 'TEXT ECONNREFUSED TEXT',
      url: 'SOME-URL-PATH',
    };

    const result = () => handleVendorError(error);

    expect(result).toThrow(
      new newError.BadGateway(
        'Connectivity Error - Unable to connect to the vendor gateway. Please check routing tables and firewall settings'
      )
    );
  });

  it('Should throw BadGateway when HTTP status is 400', () => {
    const error = {
      response: { statusCode: 400 },
      url: 'SOME-URL-PATH',
    };

    const result = () => handleVendorError(error);

    expect(result).toThrow(
      new newError.BadGateway(
        'Bad request sent from credential agent to vendor gateway (this should be raised with velocity support).'
      )
    );
  });

  it('Should throw BadGateway when HTTP status is 401', () => {
    const error = {
      response: { statusCode: 401 },
      url: 'SOME-URL-PATH',
    };

    const result = () => handleVendorError(error);

    expect(result).toThrow(
      new newError.BadGateway(
        'Bad authentication of the server. Please review the supported authentication methods for the agent.'
      )
    );
  });

  it('Should throw BadGateway when HTTP status is 403', () => {
    const error = {
      response: { statusCode: 403 },
      url: 'SOME-URL-PATH',
    };

    const result = () => handleVendorError(error);

    expect(result).toThrow(
      new newError.BadGateway(
        'Bad authentication of the server. Please review the supported authentication methods for the agent.'
      )
    );
  });

  it('Should throw BadGateway when HTTP status is 404', () => {
    const urlPath = 'SOME-URL-PATH';
    const error = {
      response: { statusCode: 404 },
      url: urlPath
    };

    const result = () => handleVendorError(error);

    expect(result).toThrow(
      new newError.BadGateway(
        `Missing implementation of the endpoint '${urlPath}'.`
      )
    );
  });

  it('Should throw BadGateway when unknown error', () => {
    const error = {
      message: 'UNKNOWN ERROR',
      url: 'SOME-URL-PATH',
    };

    const result = () => handleVendorError(error);

    expect(result).toThrow(
      new newError.BadGateway(
        'Unexpected error received connecting to vendor gateway.'
      )
    );
  });
});