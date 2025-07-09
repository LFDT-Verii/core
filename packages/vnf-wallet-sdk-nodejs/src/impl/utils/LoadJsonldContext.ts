/**
 * Created by Michael Avoyan on 15/07/2024.
 *
 * Copyright 2022 Velocity Career Labs inc.
 * SPDX-License-Identifier: Apache-2.0
 */

import { isArray } from 'lodash/fp';
import VCLLog from './VCLLog';
import Request from '../data/infrastructure/network/Request';
import { HeaderKeys, HeaderValues } from '../data/repositories/Urls';
import { Dictionary } from '../../api/VCLTypes';
import VCLError from '../../api/entities/error/VCLError';
import VCLErrorCode from '../../api/entities/error/VCLErrorCode';
import { HttpMethod } from '../data/infrastructure/network/HttpMethod';

export interface NetworkService {
    sendRequest: (request: Request) => Promise<any>;
}

export const loadJsonldContext = async (
    issuerVcPayload: Dictionary<any>, // Consider defining a more specific type
    networkService: NetworkService
): Promise<any> => {
    const extractedContexts =
        extractContexts(issuerVcPayload) ||
        extractContexts(issuerVcPayload.credentialSubject);
    if (extractedContexts) {
        const jsonldContextPromises = extractedContexts.map(
            async (jsonldContextUrl: string) => {
                try {
                    const response = await networkService.sendRequest({
                        endpoint: jsonldContextUrl,
                        method: HttpMethod.GET,
                        body: null,
                        headers: {
                            [HeaderKeys.XVnfProtocolVersion]:
                                HeaderValues.XVnfProtocolVersion,
                        },
                        useCaches: true,
                        contentType: Request.ContentTypeApplicationJson,
                    });
                    return response.payload;
                } catch (error) {
                    VCLLog.error(
                        error,
                        `Failed to load JSON-LD context from ${jsonldContextUrl}`
                    );
                    return null;
                }
            }
        );

        const contexts = await Promise.all(jsonldContextPromises);
        const validContexts: any[] = contexts.filter(
            (context) => context !== null
        );

        if (validContexts.length > 0) return validContexts[0];
        throw new VCLError(
            'context not found',
            VCLErrorCode.InvalidCredentialSubjectContext
        );
    } else if (!issuerVcPayload.credentialSubject) {
        throw new VCLError(
            'credentialSubject is NULL',
            VCLErrorCode.InvalidCredentialSubjectType
        );
    } else {
        throw new VCLError(
            'credentialSubject[@context] is NULL',
            VCLErrorCode.InvalidCredentialSubjectContext
        );
    }
};

const extractContexts = (payload: Dictionary<any>): string[] | null => {
    if (payload && payload['@context']) {
        return isArray(payload['@context'])
            ? payload['@context']
            : [payload['@context']];
    }
    return null;
};
