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

        expect(response.code).toEqual(200);
        expect(response.payload).toEqual({ hello: 'world' });
        expect(capturedRequest.method).toEqual(HttpMethod.GET);
        expect(capturedRequest.url).toEqual('/json?mode=get');
        expect(capturedRequest.headers.accept).toEqual(jsonContentType);
        expect(capturedRequest.headers['cache-control']).toEqual(
            'public, max-age=86400',
        );
        expect(capturedRequest.headers['x-trace-id']).toEqual('GET-TRACE');
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

        expect(response.code).toEqual(200);
        expect(response.payload).toEqual('plain response body');
        expect(capturedRequest.method).toEqual(HttpMethod.GET);
        expect(capturedRequest.headers['cache-control']).toBeUndefined();
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

        expect(response.code).toEqual(200);
        expect(response.payload).toEqual({ ok: true });
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

        expect(response.code).toEqual(200);
        expect(response.payload).toEqual({ accepted: true });
        expect(capturedRequest.method).toEqual(HttpMethod.POST);
        expect(parsedBody(capturedRequest.body)).toEqual({
            foo: 'bar',
            count: 2,
        });
        expect(headerValue(capturedRequest.headers['content-type'])).toContain(
            jsonContentType,
        );
        expect(capturedRequest.headers['cache-control']).toEqual(
            'public, max-age=86400',
        );
        expect(capturedRequest.headers['x-request-id']).toEqual('POST-JSON');
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
                'x-format': 'plain-text',
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
                { 'x-format': 'plain-text' },
                false,
                textPlain,
            ),
        );

        expect(response.code).toEqual(200);
        expect(response.payload).toEqual('PONG');
        expect(capturedRequest.method).toEqual(HttpMethod.POST);
        expect(capturedRequest.body).toEqual('PING');
        expect(capturedRequest.headers['content-type']).toEqual(textPlain);
        expect(capturedRequest.headers['cache-control']).toBeUndefined();
        expect(capturedRequest.headers['x-format']).toEqual('plain-text');
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
            subject.sendRequest(
                new Request(`${origin}/errors`, HttpMethod.POST, {
                    invalid: true,
                }),
            ),
        ).rejects.toMatchObject({
            payload: JSON.stringify(ErrorMocks.SomeErrorJson),
            error: ErrorMocks.SomeErrorJson.error,
            errorCode: ErrorMocks.SomeErrorJson.errorCode,
            requestId: ErrorMocks.SomeErrorJson.requestId,
            message: ErrorMocks.SomeErrorJson.message,
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
            subject.sendRequest(
                new Request(`${origin}/missing`, HttpMethod.GET, undefined),
            ),
        ).rejects.toMatchObject({
            payload: JSON.stringify(ErrorMocks.SomeErrorJson),
            error: ErrorMocks.SomeErrorJson.error,
            errorCode: ErrorMocks.SomeErrorJson.errorCode,
            requestId: ErrorMocks.SomeErrorJson.requestId,
            message: ErrorMocks.SomeErrorJson.message,
            statusCode: ErrorMocks.SomeErrorJson.statusCode,
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
            subject.sendRequest(
                new Request(`${origin}/internal-error`, HttpMethod.GET),
            ),
        ).rejects.toMatchObject({
            payload: 'server error',
            error: null,
            message: 'Request failed with status code 500',
            statusCode: 500,
        });
        expect(scope.isDone()).toBeTruthy();
    });

    test('propagates errors when no HTTP response is available', async () => {
        await expect(
            subject.sendRequest(
                new Request(`${origin}/unmatched`, HttpMethod.GET, undefined),
            ),
        ).rejects.toBeInstanceOf(VCLError);
    });
});

const headerValue = (value?: string | string[]): string | undefined =>
    Array.isArray(value) ? value.join(',') : value;

const parsedBody = (body: unknown) =>
    typeof body === 'string' ? JSON.parse(body) : body;
