/**
 * Created by OpenAI Codex on 09/04/2026.
 *
 * Copyright 2022 Velocity Career Labs inc.
 * SPDX-License-Identifier: Apache-2.0
 */

import { after, before, beforeEach, describe, test } from 'node:test';
import { once } from 'node:events';
import { createServer, type IncomingMessage } from 'node:http';
import { expect } from 'expect';
import axios from 'axios';
import NetworkServiceImpl from '../../../src/impl/data/infrastructure/network/NetworkServiceImpl';
import Request from '../../../src/impl/data/infrastructure/network/Request';
import { HttpMethod } from '../../../src/impl/data/infrastructure/network/HttpMethod';

type ResponseSpec = {
    body: object | string;
    contentType: string;
    statusCode?: number;
};

type CapturedRequest = {
    body: string;
    headers: IncomingMessage['headers'];
    method?: string;
    url?: string;
};

describe('NetworkServiceImpl integration', () => {
    let baseUrl: string;
    let capturedRequest: CapturedRequest;
    let responseSpec: ResponseSpec;
    let originalWindowXmlHttpRequest: typeof window.XMLHttpRequest;
    let originalGlobalXmlHttpRequest: typeof global.XMLHttpRequest;

    const subject = new NetworkServiceImpl();
    const server = createServer(async (request, response) => {
        capturedRequest = {
            body: await readRequestBody(request),
            headers: request.headers,
            method: request.method,
            url: request.url,
        };

        response.statusCode = responseSpec.statusCode ?? 200;
        response.setHeader('content-type', responseSpec.contentType);
        response.end(
            typeof responseSpec.body === 'string'
                ? responseSpec.body
                : JSON.stringify(responseSpec.body),
        );
    });

    before(async () => {
        originalWindowXmlHttpRequest = window.XMLHttpRequest;
        originalGlobalXmlHttpRequest = global.XMLHttpRequest;
        axios.defaults.adapter = 'http';
        // Force axios to use the Node adapter even though the package test harness enables JSDOM.

        window.XMLHttpRequest = undefined as never;

        global.XMLHttpRequest = undefined as never;

        server.listen(0, '127.0.0.1');
        await once(server, 'listening');

        const address = server.address();
        if (address == null || typeof address === 'string') {
            throw new Error('Expected server to bind to an ephemeral port');
        }

        baseUrl = `http://127.0.0.1:${address.port}`;
    });

    after(async () => {
        server.close();
        await once(server, 'close');

        window.XMLHttpRequest = originalWindowXmlHttpRequest;

        global.XMLHttpRequest = originalGlobalXmlHttpRequest;
    });

    beforeEach(() => {
        capturedRequest = {
            body: '',
            headers: {},
        };
        responseSpec = {
            body: {},
            contentType: Request.ContentTypeApplicationJson,
            statusCode: 200,
        };
    });

    test('sends GET requests with cache-control and parses json responses', async () => {
        responseSpec = {
            body: { hello: 'world' },
            contentType: Request.ContentTypeApplicationJson,
        };

        const response = await subject.sendRequest(
            new Request(`${baseUrl}/json?mode=get`, HttpMethod.GET, undefined, {
                accept: Request.ContentTypeApplicationJson,
                'x-trace-id': 'GET-TRACE',
            }),
        );

        expect(response.code).toEqual(200);
        expect(response.payload).toEqual({ hello: 'world' });
        expect(capturedRequest.method).toEqual(HttpMethod.GET);
        expect(capturedRequest.url).toEqual('/json?mode=get');
        expect(capturedRequest.headers.accept).toEqual(
            Request.ContentTypeApplicationJson,
        );
        expect(capturedRequest.headers['cache-control']).toEqual(
            'public, max-age=86400',
        );
        expect(capturedRequest.headers['x-trace-id']).toEqual('GET-TRACE');
    });

    test('parses text responses for GET requests', async () => {
        responseSpec = {
            body: 'plain response body',
            contentType: 'text/plain',
        };

        const response = await subject.sendRequest(
            new Request(
                `${baseUrl}/text`,
                HttpMethod.GET,
                undefined,
                {},
                false,
            ),
        );

        expect(response.code).toEqual(200);
        expect(response.payload).toEqual('plain response body');
        expect(capturedRequest.method).toEqual(HttpMethod.GET);
        expect(capturedRequest.headers['cache-control']).toBeUndefined();
    });

    test('sends JSON POST bodies with application/json content type', async () => {
        responseSpec = {
            body: { accepted: true },
            contentType: Request.ContentTypeApplicationJson,
        };

        const response = await subject.sendRequest(
            new Request(
                `${baseUrl}/submit`,
                HttpMethod.POST,
                { foo: 'bar', count: 2 },
                { 'x-request-id': 'POST-JSON' },
                true,
                Request.ContentTypeApplicationJson,
            ),
        );

        expect(response.code).toEqual(200);
        expect(response.payload).toEqual({ accepted: true });
        expect(capturedRequest.method).toEqual(HttpMethod.POST);
        expect(JSON.parse(capturedRequest.body)).toEqual({
            foo: 'bar',
            count: 2,
        });
        expect(capturedRequest.headers['content-type']).toContain(
            Request.ContentTypeApplicationJson,
        );
        expect(capturedRequest.headers['cache-control']).toEqual(
            'public, max-age=86400',
        );
        expect(capturedRequest.headers['x-request-id']).toEqual('POST-JSON');
    });

    test('sends text POST bodies with text/plain content type and parses text responses', async () => {
        responseSpec = {
            body: 'PONG',
            contentType: 'text/plain',
        };

        const response = await subject.sendRequest(
            new Request(
                `${baseUrl}/plain-text`,
                HttpMethod.POST,
                'PING',
                { 'x-format': 'plain-text' },
                false,
                'text/plain',
            ),
        );

        expect(response.code).toEqual(200);
        expect(response.payload).toEqual('PONG');
        expect(capturedRequest.method).toEqual(HttpMethod.POST);
        expect(capturedRequest.body).toEqual('PING');
        expect(capturedRequest.headers['content-type']).toEqual('text/plain');
        expect(capturedRequest.headers['cache-control']).toBeUndefined();
        expect(capturedRequest.headers['x-format']).toEqual('plain-text');
    });

    test('propagates non-2xx response bodies', async () => {
        responseSpec = {
            body: { error: 'bad request' },
            contentType: Request.ContentTypeApplicationJson,
            statusCode: 400,
        };

        await expect(
            subject.sendRequest(
                new Request(`${baseUrl}/errors`, HttpMethod.POST, {
                    invalid: true,
                }),
            ),
        ).rejects.toEqual({ error: 'bad request' });
    });
});

const readRequestBody = async (request: IncomingMessage): Promise<string> => {
    const chunks: Buffer[] = [];

    for await (const chunk of request) {
        chunks.push(Buffer.from(chunk));
    }

    return Buffer.concat(chunks).toString('utf8');
};
