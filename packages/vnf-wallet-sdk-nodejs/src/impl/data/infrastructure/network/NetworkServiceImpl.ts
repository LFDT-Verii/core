import { initHttpClient } from '@verii/http-client';
import { Nullish } from '../../../../api/VCLTypes';
import NetworkService from '../../../domain/infrastructure/network/NetworkService';
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

        switch (request.method) {
            case HttpMethod.GET: {
                const response = await httpClient.get(request.endpoint, {
                    headers: commonHeaders,
                });
                return new Response(await response.json(), response.statusCode);
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
                return new Response(await response.json(), response.statusCode);
            }

            default:
                throw new Error(`Unsupported HTTP method: ${request.method}`);
        }
    }

    async sendRequest(request: Request): Promise<Response> {
        this.logRequest(request);
        try {
            return this.sendRequestRaw(request);
        } catch (error: any) {
            throw error.body ?? error.response?.data ?? error;
        }
    }

    logRequest(request: Request) {
        VCLLog.info(request, 'Network request');
    }
}
