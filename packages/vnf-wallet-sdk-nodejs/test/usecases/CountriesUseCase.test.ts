import { describe, test } from 'node:test';
import { expect } from 'expect';
import NetworkServiceSuccess from '../infrastructure/resources/network/NetworkServiceSuccess';
import CountriesUseCaseImpl from '../../src/impl/data/usecases/CountriesModelUseCaseImpl';
import CountriesRepositoryImpl from '../../src/impl/data/repositories/CountriesRepositoryImpl';
import { CountriesMocks } from '../infrastructure/resources/valid/CountriesMocks';
import { VCLCountryCodes } from '../../src';

describe('CredentialManifestUseCase Tests', () => {
    const expectedCountriesPayload = JSON.parse(CountriesMocks.CountriesJson);

    const subject = new CountriesUseCaseImpl(
        new CountriesRepositoryImpl(
            new NetworkServiceSuccess(expectedCountriesPayload)
        )
    );

    test('testGetCountriesSuccess', async () => {
        const countries = await subject.getCountries();

        const receivedCountriesPayload = countries?.all?.map(
            (country) => country.payload
        );
        expect(receivedCountriesPayload).toEqual(expectedCountriesPayload);
    });
});
