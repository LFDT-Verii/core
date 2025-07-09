import { Nullish } from '../../../../api/VCLTypes';
import { HttpMethod } from './HttpMethod';

export default class Request {
    constructor(
        readonly endpoint: string,
        readonly method: HttpMethod,
        readonly body?: Nullish<any>,
        readonly headers?: { [key: string]: string },
        readonly useCaches?: boolean,
        readonly contentType?: Nullish<string>
    ) {
        if (this.useCaches == null) {
            this.useCaches = true;
        }
        if (this.headers == null) {
            this.headers = {};
        }
        if (this.contentType == null) {
            this.contentType = Request.ContentTypeApplicationJson;
        }
    }

    static readonly ContentTypeApplicationJson = 'application/json';
}
