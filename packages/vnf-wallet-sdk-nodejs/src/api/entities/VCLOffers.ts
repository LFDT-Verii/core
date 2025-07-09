import { Dictionary, Nullish } from '../VCLTypes';
import VCLToken from './VCLToken';
import VCLOffer from './VCLOffer';

export default class VCLOffers {
    constructor(
        public readonly payload: Dictionary<any>,
        public readonly all: VCLOffer[],
        public readonly responseCode: number,
        public readonly sessionToken: VCLToken,
        public readonly challenge: Nullish<string> = null
    ) {}

    static readonly fromPayload = (
        payload: Dictionary<any>,
        responseCode: number,
        sessionToken: VCLToken
    ): VCLOffers => {
        if (payload) {
            if (Array.isArray(payload)) {
                return new VCLOffers(
                    { [VCLOffers.CodingKeys.KeyOffers]: payload },
                    VCLOffers.offersFromJsonArray(payload),
                    responseCode,
                    sessionToken
                );
            }
            return new VCLOffers(
                payload,
                VCLOffers.offersFromJsonArray(
                    payload[VCLOffers.CodingKeys.KeyOffers] ?? []
                ),
                responseCode,
                sessionToken,
                payload[VCLOffers.CodingKeys.KeyChallenge]
            );
        }
        return new VCLOffers({}, [], responseCode, sessionToken);
    };

    static readonly offersFromJsonArray = (
        offersJsonArray: Dictionary<any>[]
    ): VCLOffer[] => {
        return offersJsonArray
            .filter((offerJsonObject) => offerJsonObject != null)
            .map((offerJsonObject) => new VCLOffer(offerJsonObject));
    };

    static CodingKeys = {
        KeyOffers: 'offers',
        KeyChallenge: 'challenge',
    };
}
