/**
 * Created by Michael Avoyan on 20/03/2025.
 *
 * Copyright 2022 Velocity Career Labs inc.
 * SPDX-License-Identifier: Apache-2.0
 */
import { Dictionary, Nullish } from '../../../api/VCLTypes';
import VCLCredentialTypes from '../../../api/entities/VCLCredentialTypes';
import VCLJwt from '../../../api/entities/VCLJwt';

export const getCredentialTypeMetadataByVc = (
    credentialTypes: Nullish<VCLCredentialTypes>,
    jwtVc: VCLJwt
): Dictionary<any> => {
    if (!credentialTypes || !credentialTypes?.all) return {};

    const credentialTypeName = getCredentialTypeName(jwtVc);

    const result = credentialTypes.all.find(
        (credentialTypeObj) =>
            credentialTypeObj.payload?.credentialType?.toLowerCase() ===
            credentialTypeName.toLowerCase()
    );
    return result?.payload || {};
};

const getCredentialTypeName = (jwtVc: VCLJwt): string => {
    try {
        const types = jwtVc.payload.vc[CodingKeys.KeyType] || [];
        return types[0] || '';
    } catch (e) {
        return '';
    }
};

class CodingKeys {
    static readonly KeyType = 'type';
}
