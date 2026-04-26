import { initHttpClient } from '@verii/http-client';
import type { HttpClientInitOptions, HttpResponse } from '@verii/http-client';
import { randomBytes } from 'node:crypto';
import { Nullish } from '../../../../api/VCLTypes';
import VCLError from '../../../../api/entities/error/VCLError';
import NetworkService from '../../../domain/infrastructure/network/NetworkService';
import { toNullableString } from '../../../utils/HelperFunctions';
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

        const commonHeaders = buildRequestHeaders(request, MAX_AGE);

        try {
            switch (request.method) {
                case HttpMethod.GET:
                    return await this.sendGetRequest(request, commonHeaders);

                case HttpMethod.POST:
                    return await this.sendPostRequest(request, commonHeaders);

                default:
                    throw new Error(
                        `Unsupported HTTP method: ${request.method}`,
                    );
            }
        } catch (error: any) {
            throw this.normalizeError(error);
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

    private async sendGetRequest(
        request: Request,
        headers: { [key: string]: string },
    ): Promise<Response> {
        const httpClient = this.createHttpClient({
            log: VCLLog,
            traceId: request.headers?.[TRACE_ID_HEADER] ?? generateTraceId(),
        });

        const response = await httpClient.get(request.endpoint, {
            headers,
        });
        return this.parseResponse(response);
    }

    private async sendPostRequest(
        request: Request,
        headers: { [key: string]: string },
    ): Promise<Response> {
        const httpClient = this.createHttpClient({
            log: VCLLog,
            traceId: request.headers?.[TRACE_ID_HEADER] ?? generateTraceId(),
        });

        const response = await httpClient.post(request.endpoint, request.body, {
            headers: {
                ...headers,
                ...(request.contentType == null
                    ? {}
                    : { 'content-type': request.contentType }),
            },
        });
        return this.parseResponse(response);
    }

    private async parseResponse(response: HttpResponse): Promise<Response> {
        const payload = await this.parsePayload(response);

        if (response.statusCode >= 400) {
            throw this.normalizeResponseError(
                payload,
                response.statusCode,
                response.resHeaders,
            );
        }

        return new Response(payload, response.statusCode);
    }

    private parsePayload(response: HttpResponse): Promise<any> {
        const contentType = this.headerValue(
            response.resHeaders?.['content-type'],
        );

        return this.isJsonContentType(contentType)
            ? response.json()
            : response.text();
    }

    // eslint-disable-next-line complexity
    private normalizeError(error: any): VCLError {
        if (error?.body !== undefined && error?.statusCode != null) {
            return this.normalizeResponseError(
                error.body,
                error.statusCode,
                error.headers,
            );
        }

        const response = error?.response;
        if (!response) {
            return VCLError.fromError(error);
        }

        if (this.isJsonContentType(response.headers?.['content-type'])) {
            const normalizedError = VCLError.fromPayloadJson(response.data);

            if (normalizedError.statusCode == null) {
                // eslint-disable-next-line better-mutation/no-mutation
                normalizedError.statusCode = response.status;
            }
            return normalizedError;
        }

        const textPayload = toNullableString(response.data);

        return new VCLError({
            payload: textPayload,
            message: error.message ?? textPayload,
            statusCode: response.status,
        });
    }

    private normalizeResponseError(
        payload: any,
        statusCode: number,
        headers?: Record<string, Nullish<string | string[]>>,
    ): VCLError {
        if (
            this.isJsonContentType(this.headerValue(headers?.['content-type']))
        ) {
            const normalizedError = VCLError.fromPayloadJson(payload);

            if (normalizedError.statusCode == null) {
                // eslint-disable-next-line better-mutation/no-mutation
                normalizedError.statusCode = statusCode;
            }
            return normalizedError;
        }

        const textPayload = toNullableString(payload);

        return new VCLError({
            payload: textPayload,
            message: `Request failed with status code ${statusCode}`,
            statusCode,
        });
    }

    private isJsonContentType(contentType?: string): boolean {
        if (typeof contentType !== 'string') {
            return false;
        }

        const normalizedContentType = contentType.toLowerCase();

        return (
            normalizedContentType.includes('application/json') ||
            normalizedContentType.includes('+json')
        );
    }

    private headerValue(
        value?: Nullish<string | string[]>,
    ): string | undefined {
        return Array.isArray(value) ? value.join(',') : (value ?? undefined);
    }
}

const buildRequestHeaders = (request: Request, maxAge: number) => ({
    ...(request.headers ?? {}),
    ...(request.useCaches
        ? { 'Cache-Control': `public, max-age=${maxAge}` }
        : {}),
});

const generateTraceId = () =>
    `${TRACE_ID_PREFIX}${randomBytes(6).toString('base64url')}`;
