import { after, afterEach, before } from 'node:test';
import nock from 'nock';

const REGISTRAR_ORIGIN = 'https://registrar.velocitynetwork.foundation';
const PROTOCOL_VERSION_HEADER = 'x-vnf-protocol-version';
const PROTOCOL_VERSION_VALUE = '1.0';

type HeaderValue = string | RegExp;
type ReplyHeaders = Record<string, string | string[] | number>;
type CapturedRequest = {
    body: unknown;
    headers: Record<string, string | string[] | undefined>;
    method?: string;
    url: string;
};
type CaptureRequest = (request: CapturedRequest) => void;

const withProtocolHeaders = (
    origin: string,
    headers: Record<string, HeaderValue> = {},
) => {
    let scope = nock(origin).matchHeader(
        PROTOCOL_VERSION_HEADER,
        PROTOCOL_VERSION_VALUE,
    );

    for (const [key, value] of Object.entries(headers)) {
        scope = scope.matchHeader(key, value);
    }

    return scope;
};

const withHeaders = (
    origin: string,
    headers: Record<string, HeaderValue> = {},
) => {
    let scope = nock(origin);

    for (const [key, value] of Object.entries(headers)) {
        scope = scope.matchHeader(key, value);
    }

    return scope;
};

export const useNockLifecycle = () => {
    before(() => {
        nock.disableNetConnect();
    });

    afterEach(() => {
        nock.cleanAll();
    });

    after(() => {
        nock.enableNetConnect();
    });
};

export const mockRegistrarGet = (
    path: string,
    replyBody: unknown,
    statusCode = 200,
    headers: Record<string, HeaderValue> = {},
    replyHeaders: ReplyHeaders = {},
) => {
    return withProtocolHeaders(REGISTRAR_ORIGIN, headers)
        .get(path)
        .reply(statusCode, replyBody, replyHeaders);
};

export const mockRegistrarPost = (
    path: string,
    requestBody: unknown,
    replyBody: unknown,
    statusCode = 200,
    headers: Record<string, HeaderValue> = {},
    replyHeaders: ReplyHeaders = {},
) => {
    return withProtocolHeaders(REGISTRAR_ORIGIN, headers)
        .post(path, requestBody)
        .reply(statusCode, replyBody, replyHeaders);
};

export const mockAbsoluteGet = (
    requestUrl: string,
    replyBody: unknown,
    statusCode = 200,
    headers: Record<string, HeaderValue> = {},
    replyHeaders: ReplyHeaders = {},
    captureRequest?: CaptureRequest,
) => {
    const { origin, pathname, search } = new URL(requestUrl);

    return reply(
        withHeaders(origin, headers).get(`${pathname}${search}`),
        statusCode,
        replyBody,
        replyHeaders,
        captureRequest,
    );
};

export const mockAbsolutePost = (
    requestUrl: string,
    requestBody: unknown,
    replyBody: unknown,
    statusCode = 200,
    headers: Record<string, HeaderValue> = {},
    replyHeaders: ReplyHeaders = {},
    captureRequest?: CaptureRequest,
) => {
    const { origin, pathname, search } = new URL(requestUrl);

    return reply(
        withHeaders(origin, headers).post(`${pathname}${search}`, requestBody),
        statusCode,
        replyBody,
        replyHeaders,
        captureRequest,
    );
};

const reply = (
    scope: any,
    statusCode: number,
    replyBody: unknown,
    replyHeaders: ReplyHeaders,
    captureRequest?: CaptureRequest,
) => {
    if (captureRequest == null) {
        return scope.reply(statusCode, replyBody, replyHeaders);
    }

    return scope.reply(
        statusCode,
        async (request: Request) => {
            const requestUrl = new URL(request.url);

            captureRequest({
                body: await parseBody(request),
                headers: Object.fromEntries(request.headers.entries()),
                method: request.method,
                url: `${requestUrl.pathname}${requestUrl.search}`,
            });

            return replyBody;
        },
        replyHeaders,
    );
};

const parseBody = async (request: Request): Promise<unknown> => {
    const body = await request.clone().text();

    if (!body) {
        return undefined;
    }

    try {
        return JSON.parse(body);
    } catch {
        return body;
    }
};

export const mockResolveDid = (
    did: string,
    replyBody: unknown,
    statusCode = 200,
) => {
    return mockRegistrarGet(
        `/api/v0.6/resolve-did/${did}`,
        replyBody,
        statusCode,
    );
};
