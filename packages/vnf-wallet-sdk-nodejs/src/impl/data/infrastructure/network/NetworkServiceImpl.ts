import { initHttpClient } from '@verii/http-client';
import type { HttpResponse } from '@verii/http-client';
import { Nullish } from '../../../../api/VCLTypes';
import VCLError from '../../../../api/entities/error/VCLError';
import NetworkService from '../../../domain/infrastructure/network/NetworkService';
import { toNullableString } from '../../../utils/HelperFunctions';
import VCLLog from '../../../utils/VCLLog';
import Response from './Response';
import Request from './Request';
import { HttpMethod } from './HttpMethod';

const createHttpClient = initHttpClient({});

export default class NetworkServiceImpl implements NetworkService {
    async sendRequestRaw(request: Request): Promise<Response> {
        const MAX_AGE = 60 * 60 * 24; // 24 hours

        const httpClient = createHttpClient({
            log: VCLLog,
            traceId: request.endpoint,
        });

        let commonHeaders = request.headers;
        if (request.useCaches) {
            commonHeaders = {
                ...request.headers,
                'Cache-Control': `public, max-age=${MAX_AGE}`,
            };
        }

        try {
            switch (request.method) {
                case HttpMethod.GET: {
                    const response = await httpClient.get(request.endpoint, {
                        headers: commonHeaders,
                    });
                    return this.parseResponse(response);
                }

                case HttpMethod.POST: {
                    const response = await httpClient.post(
                        request.endpoint,
                        request.body,
                        {
                            headers: {
                                ...commonHeaders,
                                ...(request.contentType == null
                                    ? {}
                                    : { 'content-type': request.contentType }),
                            },
                        },
                    );
                    return this.parseResponse(response);
                }

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
