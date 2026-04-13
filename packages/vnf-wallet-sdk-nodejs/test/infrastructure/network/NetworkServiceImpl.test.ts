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

describe('NetworkServiceImpl integration', () => {
    const subject = new NetworkServiceImpl();

    useNockLifecycle();
    beforeEach(() => undefined);

    test('sends GET requests with cache-control and parses json responses', async () => {
        const scope = mockAbsoluteGet(
            `${origin}/json?mode=get`,
            { hello: 'world' },
            200,
            {
                'cache-control': 'public, max-age=86400',
            },
            { 'content-type': jsonContentType },
        );

        const response = await subject.sendRequest(
            new Request(`${origin}/json?mode=get`, HttpMethod.GET),
        );

        expect(response.code).toEqual(200);
        expect(response.payload).toEqual({ hello: 'world' });
        expect(scope.isDone()).toBeTruthy();
    });

    test('parses text responses for GET requests', async () => {
        const scope = mockAbsoluteGet(
            `${origin}/text`,
            'plain response body',
            200,
            {},
            { 'content-type': textPlain },
        );

        const response = await subject.sendRequest(
            new Request(`${origin}/text`, HttpMethod.GET, undefined, {}, false),
        );

        expect(response.code).toEqual(200);
        expect(response.payload).toEqual('plain response body');
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
            },
            { 'content-type': jsonContentType },
        );

        const response = await subject.sendRequest(
            new Request(`${origin}/submit`, HttpMethod.POST, {
                foo: 'bar',
                count: 2,
            }),
        );

        expect(response.code).toEqual(200);
        expect(response.payload).toEqual({ accepted: true });
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

        expect(response.code).toEqual(200);
        expect(response.payload).toEqual('PONG');
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

    test('treats plain-text error bodies as human-readable VCLError messages', async () => {
        const scope = mockAbsoluteGet(
            `${origin}/internal-error`,
            'server error',
            500,
            {},
            { 'content-type': textPlain },
        );

        await expect(
            subject.sendRequest(
                new Request(
                    `${origin}/internal-error`,
                    HttpMethod.GET,
                    undefined,
                ),
            ),
        ).rejects.toMatchObject({
            payload: 'server error',
            error: null,
            message: 'server error',
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
