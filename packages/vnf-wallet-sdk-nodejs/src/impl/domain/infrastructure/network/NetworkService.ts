import Response from '../../../data/infrastructure/network/Response';
import Request from '../../../data/infrastructure/network/Request';

export default interface NetworkService {
    sendRequestRaw(request: Request): Promise<Response>;

    sendRequest(request: Request): Promise<Response>;
}
