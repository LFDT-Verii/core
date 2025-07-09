import { randomUUID } from 'crypto';
import { Dictionary, Nullish } from '../VCLTypes';

export default class VCLJwtDescriptor {
    constructor(
        /**
         * payload is Json formatted payload
         * @type Nullish<Dictionary<any>>
         * @public
         */
        public payload: Nullish<Dictionary<any>>,
        /**
         * jti is JWT ID
         * @type string
         * @public
         */
        public jti: string = randomUUID().toString(),
        /**
         * iss is the did of the wallet owner
         * @type string
         * @public
         */
        public iss: string,
        /**
         * aud is the issuer DID
         * @type string
         * @public
         */
        public aud: Nullish<string> = null
    ) {}
}
