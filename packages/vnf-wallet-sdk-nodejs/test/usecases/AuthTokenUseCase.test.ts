/**
 * Created by Michael Avoyan on 27/04/2025.
 *
 * Copyright 2022 Velocity Career Labs inc.
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, test } from 'node:test';
import { expect } from 'expect';
import TokenMocks from '../infrastructure/resources/valid/TokenMocks';
import AuthTokenUseCase from '../../src/impl/domain/usecases/AuthTokenUseCase';
import AuthTokenUseCaseImpl from '../../src/impl/data/usecases/AuthTokenUseCaseImpl';
import AuthTokenRepositoryImpl from '../../src/impl/data/repositories/AuthTokenRepositoryImpl';
import NetworkServiceImpl from '../../src/impl/data/infrastructure/network/NetworkServiceImpl';
import { VCLAuthToken, VCLAuthTokenDescriptor, VCLErrorCode } from '../../src';
import { mockAbsolutePost, useNockLifecycle } from '../utils/nock';

describe('AuthTokenUseCaseTest', () => {
    const authTokenUri = 'https://wallet.example.test/oauth/token';
    const expectedAuthToken = TokenMocks.AuthToken;
    const authTokenDescriptor = new VCLAuthTokenDescriptor(
        authTokenUri,
        'refresh-token',
        'wallet did',
        'relying party did',
    );
    const subject: AuthTokenUseCase = new AuthTokenUseCaseImpl(
        new AuthTokenRepositoryImpl(new NetworkServiceImpl()),
    );

    useNockLifecycle();

    test('testGetAuthTokenSuccess', async () => {
        const scope = mockAbsolutePost(
            authTokenUri,
            authTokenDescriptor.generateRequestBody(),
            expectedAuthToken.payload,
            200,
            {
                'content-type': /application\/json/,
            },
        );

        const authToken = await subject.getAuthToken(authTokenDescriptor);
        const expectedResolvedAuthToken = new VCLAuthToken(
            expectedAuthToken.payload,
            authTokenUri,
            'wallet did',
            'relying party did',
        );

        expect(authToken).toEqual(expectedResolvedAuthToken);
        expect(scope.isDone()).toBeTruthy();
    });

    test('testGetAuthTokenFailure', async () => {
        const scope = mockAbsolutePost(
            authTokenUri,
            authTokenDescriptor.generateRequestBody(),
            { payload: 'Wrong payload' },
            200,
            {
                'content-type': /application\/json/,
            },
        );

        try {
            await subject.getAuthToken(authTokenDescriptor);
            expect(true).toBeFalsy();
        } catch (error: any) {
            expect(error?.errorCode).toEqual(VCLErrorCode.SdkError.toString());
        }

        expect(scope.isDone()).toBeTruthy();
    });
});
