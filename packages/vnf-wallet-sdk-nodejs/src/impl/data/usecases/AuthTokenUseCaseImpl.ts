/**
 * Created by Michael Avoyan on 30/03/2025.
 *
 * Copyright 2022 Velocity Career Labs inc.
 * SPDX-License-Identifier: Apache-2.0
 */
import VCLAuthToken from '../../../api/entities/VCLAuthToken';
import VCLAuthTokenDescriptor from '../../../api/entities/VCLAuthTokenDescriptor';
import AuthTokenUseCase from '../../domain/usecases/AuthTokenUseCase';
import VCLError from '../../../api/entities/error/VCLError';
import AuthTokenRepository from '../../domain/repositories/AuthTokenRepository';

export default class AuthTokenUseCaseImpl implements AuthTokenUseCase {
    constructor(private readonly authTokenRepository: AuthTokenRepository) {}

    async getAuthToken(
        authTokenDescriptor: VCLAuthTokenDescriptor
    ): Promise<VCLAuthToken> {
        try {
            return await this.authTokenRepository.getAuthToken(
                authTokenDescriptor
            );
        } catch (error: any) {
            throw VCLError.fromError(error);
        }
    }
}
