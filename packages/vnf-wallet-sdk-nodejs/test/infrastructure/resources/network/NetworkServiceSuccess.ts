import Response from '../../../../src/impl/data/infrastructure/network/Response';
import Request from '../../../../src/impl/data/infrastructure/network/Request';
import NetworkService from '../../../../src/impl/domain/infrastructure/network/NetworkService';

export default class NetworkServiceSuccess implements NetworkService {
    sendRequestCalled = false;

    request?: Request = undefined;

    constructor(private readonly validResponse: any) {}

    async sendRequestRaw(): Promise<Response> {
        return new Response(this.validResponse, 200);
    }

    async sendRequest(request: Request): Promise<Response> {
        this.sendRequestCalled = true;
        this.request = request;
        return new Response(this.validResponse, 0);
    }
}
