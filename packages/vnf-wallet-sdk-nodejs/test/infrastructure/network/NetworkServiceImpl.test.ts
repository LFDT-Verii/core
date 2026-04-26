/**
 * Copyright 2022 Velocity Career Labs inc.
 * SPDX-License-Identifier: Apache-2.0
 */

import { beforeEach, describe, test } from 'node:test';
import { expect } from 'expect';
import NetworkServiceImpl from '../../../src/impl/data/infrastructure/network/NetworkServiceImpl';
import Request from '../../../src/impl/data/infrastructure/network/Request';
import { HttpMethod } from '../../../src/impl/data/infrastructure/network/HttpMethod';
import VCLError from '../../../src/api/entities/error/VCLError';
import { ErrorMocks } from '../../infrastructure/resources/valid/ErrorMocks';
import {
    mockAbsoluteGet,
    mockAbsolutePost,
    useNockLifecycle,
} from '../../utils/nock';

const origin = 'https://network-service.test';
const textPlain = 'text/plain';
const jsonContentType = Request.ContentTypeApplicationJson;

type CapturedRequest = {
    body: unknown;
    headers: Record<string, string | string[] | undefined>;
    method?: string;
    url: string;
};

describe('NetworkServiceImpl integration', () => {
    const subject = new NetworkServiceImpl();
    let capturedRequest: CapturedRequest;

    useNockLifecycle();
    beforeEach(() => {
        capturedRequest = {
            body: undefined,
            headers: {},
            url: '',
        };
    });

    test('sends GET requests with cache-control and parses json responses', async () => {
        const scope = mockAbsoluteGet(
            `${origin}/json?mode=get`,
            { hello: 'world' },
            200,
            {
                accept: jsonContentType,
                'cache-control': 'public, max-age=86400',
                'x-trace-id': 'GET-TRACE',
            },
            { 'content-type': jsonContentType },
            (request) => {
                capturedRequest = request;
            },
        );

        const response = await subject.sendRequest(
            new Request(`${origin}/json?mode=get`, HttpMethod.GET, undefined, {
                accept: jsonContentType,
                'x-trace-id': 'GET-TRACE',
            }),
        );

        expect(responseDetails(response)).toEqual({
            code: 200,
            payload: { hello: 'world' },
        });
        expect(requestDetails(capturedRequest)).toEqual({
            headers: {
                accept: jsonContentType,
                'cache-control': 'public, max-age=86400',
                'x-trace-id': 'GET-TRACE',
            },
            method: HttpMethod.GET,
            url: '/json?mode=get',
        });
        expect(scope.isDone()).toBeTruthy();
    });

    test('parses text responses for GET requests', async () => {
        const scope = mockAbsoluteGet(
            `${origin}/text`,
            'plain response body',
            200,
            {},
            { 'content-type': textPlain },
            (request) => {
                capturedRequest = request;
            },
        );

        const response = await subject.sendRequest(
            new Request(`${origin}/text`, HttpMethod.GET, undefined, {}, false),
        );

        expect(responseDetails(response)).toEqual({
            code: 200,
            payload: 'plain response body',
        });
        expect(requestDetails(capturedRequest)).toEqual({
            headers: {
                'x-trace-id': expect.stringMatching(
                    /^vnf-sdk_[A-Za-z0-9_-]{8}$/,
                ),
            },
            method: HttpMethod.GET,
            url: '/text',
        });
        expect(scope.isDone()).toBeTruthy();
    });

    test('generates a short x-trace-id when one is not provided', async () => {
        const scope = mockAbsoluteGet(
            `${origin}/generated-trace-id`,
            { ok: true },
            200,
            {
                'x-trace-id': /^vnf-sdk_[A-Za-z0-9_-]{8}$/,
            },
            { 'content-type': jsonContentType },
        );

        const response = await subject.sendRequest(
            new Request(`${origin}/generated-trace-id`, HttpMethod.GET),
        );

        expect(responseDetails(response)).toEqual({
            code: 200,
            payload: { ok: true },
        });
        expect(scope.isDone()).toBeTruthy();
    });

    test('sends JSON POST bodies with application/json content type', async () => {
        const scope = mockAbsolutePost(
            `${origin}/submit`,
            { foo: 'bar', count: 2 },
            { accepted: true },
            200,
            {
                'cache-control': 'public, max-age=86400',
                'content-type': new RegExp(`^${jsonContentType}`),
                'x-request-id': 'POST-JSON',
            },
            { 'content-type': jsonContentType },
            (request) => {
                capturedRequest = request;
            },
        );

        const response = await subject.sendRequest(
            new Request(
                `${origin}/submit`,
                HttpMethod.POST,
                { foo: 'bar', count: 2 },
                { 'x-request-id': 'POST-JSON' },
                true,
                jsonContentType,
            ),
        );

        expect(responseDetails(response)).toEqual({
            code: 200,
            payload: { accepted: true },
        });
        expect(requestDetails(capturedRequest)).toEqual({
            body: {
                foo: 'bar',
                count: 2,
            },
            headers: {
                'cache-control': 'public, max-age=86400',
                'content-type': expect.stringMatching(
                    new RegExp(`^${jsonContentType}`),
                ),
                'x-request-id': 'POST-JSON',
                'x-trace-id': expect.stringMatching(
                    /^vnf-sdk_[A-Za-z0-9_-]{8}$/,
                ),
            },
            method: HttpMethod.POST,
            url: '/submit',
        });
        expect(scope.isDone()).toBeTruthy();
    });

    test('sends text POST bodies with text/plain content type and parses text responses', async () => {
        const scope = mockAbsolutePost(
            `${origin}/plain-text`,
            'PING',
            'PONG',
            200,
            {
                'content-type': textPlain,
            },
            { 'content-type': textPlain },
            (request) => {
                capturedRequest = request;
            },
        );

        const response = await subject.sendRequest(
            new Request(
                `${origin}/plain-text`,
                HttpMethod.POST,
                'PING',
                {},
                false,
                textPlain,
            ),
        );

        expect(responseDetails(response)).toEqual({
            code: 200,
            payload: 'PONG',
        });
        expect(requestDetails(capturedRequest)).toEqual({
            body: 'PING',
            headers: {
                'content-type': textPlain,
                'x-trace-id': expect.stringMatching(
                    /^vnf-sdk_[A-Za-z0-9_-]{8}$/,
                ),
            },
            method: HttpMethod.POST,
            url: '/plain-text',
        });
        expect(scope.isDone()).toBeTruthy();
    });

    test('parses JSON error bodies as VCLError payloads', async () => {
        const scope = mockAbsolutePost(
            `${origin}/errors`,
            { invalid: true },
            ErrorMocks.SomeErrorJson,
            400,
            {
                'cache-control': 'public, max-age=86400',
                'content-type': new RegExp(`^${jsonContentType}`),
            },
            { 'content-type': jsonContentType },
        );

        await expect(
            rejectedVCLErrorJson(
                subject.sendRequest(
                    new Request(`${origin}/errors`, HttpMethod.POST, {
                        invalid: true,
                    }),
                ),
            ),
        ).resolves.toEqual({
            error: ErrorMocks.SomeErrorJson.error,
            errorCode: ErrorMocks.SomeErrorJson.errorCode,
            message: ErrorMocks.SomeErrorJson.message,
            payload: JSON.stringify(ErrorMocks.SomeErrorJson),
            requestId: ErrorMocks.SomeErrorJson.requestId,
            statusCode: ErrorMocks.SomeErrorJson.statusCode,
        });
        expect(scope.isDone()).toBeTruthy();
    });

    test('parses JSON 404 error bodies as VCLError payloads', async () => {
        const scope = mockAbsoluteGet(
            `${origin}/missing`,
            ErrorMocks.SomeErrorJson,
            404,
            {},
            { 'content-type': jsonContentType },
        );

        await expect(
            rejectedVCLErrorJson(
                subject.sendRequest(
                    new Request(`${origin}/missing`, HttpMethod.GET, undefined),
                ),
            ),
        ).resolves.toEqual({
            error: ErrorMocks.SomeErrorJson.error,
            errorCode: ErrorMocks.SomeErrorJson.errorCode,
            message: ErrorMocks.SomeErrorJson.message,
            payload: JSON.stringify(ErrorMocks.SomeErrorJson),
            requestId: ErrorMocks.SomeErrorJson.requestId,
            statusCode: ErrorMocks.SomeErrorJson.statusCode,
        });
        expect(scope.isDone()).toBeTruthy();
    });

    test('uses HTTP status when JSON error body has no statusCode', async () => {
        const errorBody = {
            error: 'missing_status',
            errorCode: 'missing_status_code',
            message: 'Missing status code',
            requestId: 'request-123',
        };
        const scope = mockAbsoluteGet(
            `${origin}/missing-status`,
            errorBody,
            422,
            {},
            { 'content-type': jsonContentType },
        );

        await expect(
            rejectedVCLErrorJson(
                subject.sendRequest(
                    new Request(
                        `${origin}/missing-status`,
                        HttpMethod.GET,
                        undefined,
                    ),
                ),
            ),
        ).resolves.toEqual({
            error: errorBody.error,
            errorCode: errorBody.errorCode,
            message: errorBody.message,
            payload: JSON.stringify(errorBody),
            requestId: errorBody.requestId,
            statusCode: 422,
        });
        expect(scope.isDone()).toBeTruthy();
    });

    test('treats plain-text 500 error bodies as human-readable VCLError messages', async () => {
        const scope = mockAbsoluteGet(
            `${origin}/internal-error`,
            'server error',
            500,
            {},
            { 'content-type': textPlain },
        );

        await expect(
            rejectedVCLErrorJson(
                subject.sendRequest(
                    new Request(`${origin}/internal-error`, HttpMethod.GET),
                ),
            ),
        ).resolves.toEqual({
            error: null,
            errorCode: 'sdk_error',
            message: 'Request failed with status code 500',
            payload: 'server error',
            requestId: null,
            statusCode: 500,
        });
        expect(scope.isDone()).toBeTruthy();
    });

    test('treats error bodies with missing content type as text', async () => {
        const scope = mockAbsoluteGet(
            `${origin}/missing-content-type`,
            'missing content type',
            500,
        );

        await expect(
            rejectedVCLErrorJson(
                subject.sendRequest(
                    new Request(
                        `${origin}/missing-content-type`,
                        HttpMethod.GET,
                    ),
                ),
            ),
        ).resolves.toEqual({
            error: null,
            errorCode: 'sdk_error',
            message: 'Request failed with status code 500',
            payload: '',
            requestId: null,
            statusCode: 500,
        });
        expect(scope.isDone()).toBeTruthy();
    });

    test('normalizes unsupported HTTP methods', async () => {
        await expect(
            rejectedVCLErrorJson(
                subject.sendRequest(
                    new Request(
                        `${origin}/unsupported`,
                        'PUT' as HttpMethod,
                        undefined,
                    ),
                ),
            ),
        ).resolves.toEqual({
            error: '{}',
            errorCode: 'sdk_error',
            message: 'Unsupported HTTP method: PUT',
            payload: null,
            requestId: null,
            statusCode: null,
        });
    });

    test('propagates errors when no HTTP response is available', async () => {
        await expect(
            subject.sendRequest(
                new Request(`${origin}/unmatched`, HttpMethod.GET, undefined),
            ),
        ).rejects.toBeInstanceOf(VCLError);
    });
});

const responseDetails = (response: { code: number; payload: unknown }) => ({
    code: response.code,
    payload: response.payload,
});

const requestDetails = (request: CapturedRequest) => ({
    ...(request.body === undefined ? {} : { body: request.body }),
    headers: compact({
        accept: headerValue(request.headers.accept),
        'cache-control': headerValue(request.headers['cache-control']),
        'content-type': headerValue(request.headers['content-type']),
        'x-request-id': headerValue(request.headers['x-request-id']),
        'x-trace-id': headerValue(request.headers['x-trace-id']),
    }),
    method: request.method,
    url: request.url,
});

const headerValue = (value?: string | string[]): string | undefined =>
    Array.isArray(value) ? value.join(',') : value;

const compact = <T extends Record<string, unknown>>(object: T) =>
    Object.fromEntries(
        Object.entries(object).filter(([, value]) => value !== undefined),
    );

const rejectedVCLErrorJson = async (
    promise: Promise<unknown>,
): Promise<VCLError['jsonObject']> => {
    try {
        await promise;
    } catch (error) {
        expect(error).toBeInstanceOf(VCLError);
        return (error as VCLError).jsonObject;
    }

    throw new Error('Expected promise to reject with VCLError');
};
