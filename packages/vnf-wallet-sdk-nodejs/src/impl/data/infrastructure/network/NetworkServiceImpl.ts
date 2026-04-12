import { initHttpClient } from '@verii/http-client';
import type { HttpClientInitOptions } from '@verii/http-client';
import { nanoid } from 'nanoid';
import NetworkService from '../../../domain/infrastructure/network/NetworkService';
import VCLLog from '../../../utils/VCLLog';
import Response from './Response';
import Request from './Request';
import { HttpMethod } from './HttpMethod';

type NetworkServiceImplOptions = Pick<HttpClientInitOptions, 'isTest'>;
const TRACE_ID_HEADER = 'x-trace-id';
const TRACE_ID_PREFIX = 'vnf-sdk_';

export default class NetworkServiceImpl implements NetworkService {
    private readonly createHttpClient;

    constructor(options: NetworkServiceImplOptions = {}) {
        this.createHttpClient = initHttpClient({
            isTest: process.env.NODE_ENV === 'test',
            traceIdHeader: TRACE_ID_HEADER,
            ...options,
        });
    }

    async sendRequestRaw(request: Request): Promise<Response> {
        const MAX_AGE = 60 * 60 * 24; // 24 hours

        const httpClient = this.createHttpClient({
            log: VCLLog,
            traceId: request.headers?.[TRACE_ID_HEADER] ?? generateTraceId(),
        });

        const commonHeaders = buildRequestHeaders(request, MAX_AGE);

        switch (request.method) {
            case HttpMethod.GET:
                return sendGetRequest(httpClient, request, commonHeaders);
            case HttpMethod.POST:
                return sendPostRequest(httpClient, request, commonHeaders);

            default:
                throw new Error(`Unsupported HTTP method: ${request.method}`);
        }
    }

    async sendRequest(request: Request): Promise<Response> {
        this.logRequest(request);
        try {
            return await this.sendRequestRaw(request);
        } catch (error: any) {
            throw error.body ?? error.response?.data ?? error;
        }
    }

    logRequest(request: Request) {
        VCLLog.info(request, 'Network request');
    }
}

const parsePayload = async (response: {
    json: () => Promise<any>;
    resHeaders: Record<string, string | string[] | undefined>;
    text: () => Promise<string>;
}) => {
    const contentType = response.resHeaders['content-type'];

    if (
        typeof contentType === 'string' &&
        contentType.startsWith('text/plain')
    ) {
        return response.text();
    }

    return response.json();
};

const buildRequestHeaders = (request: Request, maxAge: number) =>
    request.useCaches
        ? {
              ...request.headers,
              'Cache-Control': `public, max-age=${maxAge}`,
          }
        : request.headers;

const sendGetRequest = async (
    httpClient: ReturnType<NetworkServiceImpl['createHttpClient']>,
    request: Request,
    headers: { [key: string]: string },
) => {
    const response = await httpClient.get(request.endpoint, {
        headers,
    });
    return new Response(await parsePayload(response), response.statusCode);
};

const sendPostRequest = async (
    httpClient: ReturnType<NetworkServiceImpl['createHttpClient']>,
    request: Request,
    headers: { [key: string]: string },
) => {
    const response = await httpClient.post(request.endpoint, request.body, {
        headers: {
            ...headers,
            ...(request.contentType == null
                ? {}
                : { 'content-type': request.contentType }),
        },
    });
    return new Response(await parsePayload(response), response.statusCode);
};

const generateTraceId = () => `${TRACE_ID_PREFIX}${nanoid(8)}`;
