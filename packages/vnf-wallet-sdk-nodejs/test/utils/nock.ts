import { after, afterEach, before } from 'node:test';
import nock from 'nock';

const REGISTRAR_ORIGIN = 'https://registrar.velocitynetwork.foundation';
const PROTOCOL_VERSION_HEADER = 'x-vnf-protocol-version';
const PROTOCOL_VERSION_VALUE = '1.0';

type HeaderValue = string | RegExp;
type ReplyHeaders = Record<string, string>;

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
) => {
    const { origin, pathname, search } = new URL(requestUrl);

    return withHeaders(origin, headers)
        .get(`${pathname}${search}`)
        .reply(statusCode, replyBody, replyHeaders);
};

export const mockAbsolutePost = (
    requestUrl: string,
    requestBody: unknown,
    replyBody: unknown,
    statusCode = 200,
    headers: Record<string, HeaderValue> = {},
    replyHeaders: ReplyHeaders = {},
) => {
    const { origin, pathname, search } = new URL(requestUrl);

    return withHeaders(origin, headers)
        .post(`${pathname}${search}`, requestBody)
        .reply(statusCode, replyBody, replyHeaders);
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
