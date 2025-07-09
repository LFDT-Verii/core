/**
 * Created by Michael Avoyan on 04/06/2025.
 *
 * Copyright 2022 Velocity Career Labs inc.
 * SPDX-License-Identifier: Apache-2.0
 */

import ResolveDidDocumentRepository from '../../domain/repositories/ResolveDidDocumentRepository';
import VCLDidDocument from '../../../api/entities/VCLDidDocument';
import NetworkService from '../../domain/infrastructure/network/NetworkService';
import Urls, { HeaderKeys, HeaderValues } from './Urls';
import { HttpMethod } from '../infrastructure/network/HttpMethod';

export default class ResolveDidDocumentRepositoryImpl
    implements ResolveDidDocumentRepository
{
    constructor(private readonly networkService: NetworkService) {}

    async resolveDidDocument(did: string): Promise<VCLDidDocument> {
        const didDocumentResponse = await this.networkService.sendRequest({
            endpoint: `${Urls.ResolveDid + did}`,
            method: HttpMethod.GET,
            headers: {
                [HeaderKeys.XVnfProtocolVersion]:
                    HeaderValues.XVnfProtocolVersion,
            },
            body: null,
            contentType: null,
            useCaches: true,
        });
        return new VCLDidDocument(didDocumentResponse.payload);
    }
}
