import axios, { AxiosResponse } from 'axios';
import { Nullish } from '../../../../api/VCLTypes';
import VCLError from '../../../../api/entities/error/VCLError';
import NetworkService from '../../../domain/infrastructure/network/NetworkService';
import VCLLog from '../../../utils/VCLLog';
import Response from './Response';
import Request from './Request';
import { HttpMethod } from './HttpMethod';

export default class NetworkServiceImpl implements NetworkService {
    async sendRequestRaw(request: Request): Promise<Response> {
        const MAX_AGE = 60 * 60 * 24; // 24 hours

        let handler: () => Nullish<Promise<AxiosResponse>> = () => null;

        let commonHeaders = request.headers;
        if (request.useCaches) {
            commonHeaders = {
                ...request.headers,
                'Cache-Control': `public, max-age=${MAX_AGE}`,
            };
        }

        switch (request.method) {
            case HttpMethod.GET:
                handler = () =>
                    axios.create({ ...axios.defaults }).get(request.endpoint, {
                        headers: commonHeaders,
                    });
                break;

            case HttpMethod.POST:
                handler = () =>
                    axios
                        .create({ ...axios.defaults })
                        .post(request.endpoint, request.body, {
                            headers: {
                                ...commonHeaders,
                                'Content-Type': request.contentType,
                            },
                        });
                break;

            default:
                break;
        }

        try {
            const r = await handler();
            return new Response(r!.data, r!.status);
        } catch (error: any) {
            throw this.normalizeError(error);
        }
    }

    async sendRequest(request: Request): Promise<Response> {
        this.logRequest(request);
        return this.sendRequestRaw(request);
    }

    logRequest(request: Request) {
        VCLLog.info(request, 'Network request');
    }

    // eslint-disable-next-line complexity
    private normalizeError(error: any): VCLError {
        const response = error?.response;
        const payload = response?.data;

        if (response) {
            const jsonPayload = this.toJsonPayload(payload);
            if (jsonPayload != null) {
                return VCLError.fromPayload(jsonPayload);
            }

            if (payload != null) {
                const textPayload =
                    typeof payload === 'string' ? payload : String(payload);

                return new VCLError({
                    payload: textPayload,
                    message: textPayload,
                    statusCode: response.status,
                });
            }
        }

        return VCLError.fromError(error, response?.status);
    }

    private toJsonPayload(payload: unknown): Nullish<string> {
        if (typeof payload === 'string') {
            try {
                JSON.parse(payload);
                return payload;
            } catch {
                return null;
            }
        }

        if (payload && typeof payload === 'object') {
            return JSON.stringify(payload);
        }

        return null;
    }
}
