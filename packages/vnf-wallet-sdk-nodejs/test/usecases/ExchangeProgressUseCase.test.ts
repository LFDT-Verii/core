import { describe, test } from 'node:test';
import { expect } from 'expect';
import ExchangeProgressRepositoryImpl from '../../src/impl/data/repositories/ExchangeProgressRepositoryImpl';
import ExchangeProgressUseCaseImpl from '../../src/impl/data/usecases/ExchangeProgressUseCaseImpl';
import { ExchangeProgressMocks } from '../infrastructure/resources/valid/ExchangeProgressMocks';
import { VCLExchange, VCLExchangeDescriptor } from '../../src';
import NetworkServiceImpl from '../../src/impl/data/infrastructure/network/NetworkServiceImpl';
import { CommonMocks } from '../infrastructure/resources/CommonMocks';
import { mockAbsoluteGet, useNockLifecycle } from '../utils/nock';

describe('ExchangeProgressUseCase', () => {
    const subject = new ExchangeProgressUseCaseImpl(
        new ExchangeProgressRepositoryImpl(new NetworkServiceImpl()),
    );
    const exchangeDescriptor = {
        exchangeId: 'exchange-id',
        processUri: 'https://agent.velocitycareerlabs.io/get-exchange-progress',
        sessionToken: CommonMocks.Token,
    } as VCLExchangeDescriptor;

    useNockLifecycle();

    test('returns exchange progress', async () => {
        const scope = mockAbsoluteGet(
            `${exchangeDescriptor.processUri}?exchange_id=${exchangeDescriptor.exchangeId}`,
            ExchangeProgressMocks.ExchangeProgressJson,
            200,
            {
                authorization: `Bearer ${exchangeDescriptor.sessionToken.value}`,
            },
        );

        const exchange = await subject.getExchangeProgress(exchangeDescriptor);

        expect(exchange).toEqual(
            new VCLExchange(ExchangeProgressMocks.ExchangeProgressJson),
        );
        expect(scope.isDone()).toBeTruthy();
    });

    test('returns an empty exchange for an invalid exchange progress response', async () => {
        const scope = mockAbsoluteGet(
            `${exchangeDescriptor.processUri}?exchange_id=${exchangeDescriptor.exchangeId}`,
            '',
            200,
            {
                authorization: `Bearer ${exchangeDescriptor.sessionToken.value}`,
            },
        );

        const exchange = await subject.getExchangeProgress(exchangeDescriptor);

        expect(exchange).toEqual(new VCLExchange({}));
        expect(scope.isDone()).toBeTruthy();
    });
});
