import { expect } from '@jest/globals';
import NetworkServiceSuccess from '../infrastructure/resources/network/NetworkServiceSuccess';
import ExchangeProgressRepositoryImpl from '../../src/impl/data/repositories/ExchangeProgressRepositoryImpl';
import ExchangeProgressUseCaseImpl from '../../src/impl/data/usecases/ExchangeProgressUseCaseImpl';
import { ExchangeProgressMocks } from '../infrastructure/resources/valid/ExchangeProgressMocks';
import {
    Dictionary,
    VCLExchange,
    VCLExchangeDescriptor,
    VCLToken,
} from '../../src';

describe('ExchangeProgressUseCase Tests', () => {
    const subject1 = new ExchangeProgressUseCaseImpl(
        new ExchangeProgressRepositoryImpl(
            new NetworkServiceSuccess(
                ExchangeProgressMocks.ExchangeProgressJson
            )
        )
    );
    const subject2 = new ExchangeProgressUseCaseImpl(
        new ExchangeProgressRepositoryImpl(new NetworkServiceSuccess(''))
    );
    const exchangeDescriptor = {
        exchangeId: '',
        processUri: '',
        sessionToken: new VCLToken(''),
    } as VCLExchangeDescriptor;

    test('testGetExchangeProgressSuccess', async () => {
        const exchange = await subject1.getExchangeProgress(exchangeDescriptor);

        expect(exchange.id).toEqual(
            ExchangeProgressMocks.ExchangeProgressJson.id
        );
        expect(exchange.type).toEqual(
            ExchangeProgressMocks.ExchangeProgressJson.type
        );
        expect(exchange.exchangeComplete).toEqual(
            ExchangeProgressMocks.ExchangeProgressJson.exchangeComplete
        );
        expect(exchange.disclosureComplete).toEqual(
            ExchangeProgressMocks.ExchangeProgressJson.disclosureComplete
        );
    });

    test('testGetExchangeProgressFailure', async () => {
        const exchange = await subject2.getExchangeProgress(exchangeDescriptor);

        expect(exchange.id).toEqual(undefined);
        expect(exchange.type).toEqual(undefined);
        expect(exchange.disclosureComplete).toEqual(undefined);
        expect(exchange.exchangeComplete).toEqual(undefined);
    });
});
