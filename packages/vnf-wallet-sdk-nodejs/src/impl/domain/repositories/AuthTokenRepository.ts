/**
 * Created by Michael Avoyan on 30/03/2025.
 *
 * Copyright 2022 Velocity Career Labs inc.
 * SPDX-License-Identifier: Apache-2.0
 */
import VCLAuthToken from '../../../api/entities/VCLAuthToken';
import VCLAuthTokenDescriptor from '../../../api/entities/VCLAuthTokenDescriptor';

export default interface AuthTokenRepository {
    getAuthToken(
        authTokenDescriptor: VCLAuthTokenDescriptor
    ): Promise<VCLAuthToken>;
}
