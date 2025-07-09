/**
 * Created by Michael Avoyan on 27/05/2025.
 *
 * Copyright 2022 Velocity Career Labs inc.
 * SPDX-License-Identifier: Apache-2.0
 */
import {
    Dictionary,
    VCLExchange,
    VCLSubmissionResult,
    VCLToken,
} from '../../../../src';

export const generatePresentationSubmissionResult = (
    jsonObj: Dictionary<any>,
    jti: string,
    submissionId: string
): VCLSubmissionResult => {
    const exchangeJsonObj = jsonObj[VCLSubmissionResult.KeyExchange];
    return new VCLSubmissionResult(
        new VCLToken(jsonObj[VCLSubmissionResult.KeyToken]),
        expectedExchange(exchangeJsonObj),
        jti,
        submissionId
    );
};
const expectedExchange = (exchangeJsonObj: Dictionary<any>): VCLExchange => {
    return new VCLExchange(
        exchangeJsonObj[VCLExchange.KeyId],
        exchangeJsonObj[VCLExchange.KeyType],
        exchangeJsonObj[VCLExchange.KeyDisclosureComplete],
        exchangeJsonObj[VCLExchange.KeyExchangeComplete]
    );
};
