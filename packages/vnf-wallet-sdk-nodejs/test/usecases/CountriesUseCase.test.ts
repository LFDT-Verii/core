import { describe, test } from 'node:test';
import { expect } from 'expect';
import NetworkServiceImpl from '../../src/impl/data/infrastructure/network/NetworkServiceImpl';
import CountriesUseCaseImpl from '../../src/impl/data/usecases/CountriesModelUseCaseImpl';
import CountriesRepositoryImpl from '../../src/impl/data/repositories/CountriesRepositoryImpl';
import { CountriesMocks } from '../infrastructure/resources/valid/CountriesMocks';
import { mockRegistrarGet, useNockLifecycle } from '../utils/nock';

describe('CountriesUseCase', () => {
    const expectedCountriesPayload = JSON.parse(CountriesMocks.CountriesJson);

    const subject = new CountriesUseCaseImpl(
        new CountriesRepositoryImpl(new NetworkServiceImpl()),
    );

    useNockLifecycle();

    test('returns countries', async () => {
        const scope = mockRegistrarGet(
            '/reference/countries',
            expectedCountriesPayload,
        );

        const countries = await subject.getCountries();

        const receivedCountriesPayload = countries?.all?.map(
            (country) => country.payload,
        );
        expect(receivedCountriesPayload).toEqual(expectedCountriesPayload);
        expect(scope.isDone()).toBeTruthy();
    });
});
