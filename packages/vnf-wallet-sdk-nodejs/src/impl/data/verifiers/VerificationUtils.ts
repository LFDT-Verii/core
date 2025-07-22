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
            credentialTypeName?.toLowerCase()
    );
    return result?.payload || {};
};

/**
 * The implementation relaying on the below reference:
 * https://github.com/LFDT-Verii/core
 * /blob/37c8535c2ef839ed72a2706685a398f20f4ae11c/packages/vc-checks/src/extract-credential-type.js#L20
 */
const getCredentialTypeName = (jwtVc: VCLJwt): string | undefined => {
    const types = jwtVc.payload?.vc?.type || [];
    return types?.find((type: any) => type !== 'VerifiableCredential');
};
