import { Dictionary } from '../VCLTypes';

export default class VCLExchange {
    public id: string;

    public type: string;

    public disclosureComplete: boolean;

    public exchangeComplete: boolean;

    // Constructor overloads
    constructor(
        id: string,
        type: string,
        disclosureComplete: boolean,
        exchangeComplete: boolean
    );

    constructor(payload: Dictionary<any>);

    // Unified constructor implementation
    constructor(...args: any[]) {
        if (args.length === 1 && typeof args[0] === 'object') {
            const payload = args[0];
            this.id = payload[VCLExchange.KeyId];
            this.type = payload[VCLExchange.KeyType];
            this.disclosureComplete =
                payload[VCLExchange.KeyDisclosureComplete];
            this.exchangeComplete = payload[VCLExchange.KeyExchangeComplete];
        } else if (args.length === 4) {
            const [id, type, disclosureComplete, exchangeComplete] = args;
            this.id = id;
            this.type = type;
            this.disclosureComplete = disclosureComplete;
            this.exchangeComplete = exchangeComplete;
        } else {
            throw new Error('Invalid constructor arguments for VCLExchange');
        }
    }

    static readonly KeyId: string = 'id';

    static readonly KeyType: string = 'type';

    static readonly KeyDisclosureComplete: string = 'disclosureComplete';

    static readonly KeyExchangeComplete: string = 'exchangeComplete';
}
