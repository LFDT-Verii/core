import VCLCountries from '../../src/api/entities/VCLCountries';
import CredentialTypesUIFormSchemaUseCase from '../../src/impl/domain/usecases/CredentialTypesUIFormSchemaUseCase';
import CredentialTypesUIFormSchemaUseCaseImpl from '../../src/impl/data/usecases/CredentialTypesUIFormSchemaUseCaseImpl';
import CredentialTypesUIFormSchemaRepositoryImpl from '../../src/impl/data/repositories/CredentialTypesUIFormSchemaRepositoryImpl';
import { CredentialTypesUIFormSchemaMocks } from '../infrastructure/resources/valid/CredentialTypesUIFormSchemaMocks';
import NetworkServiceSuccess from '../infrastructure/resources/network/NetworkServiceSuccess';
import VCLCredentialTypesUIFormSchema from '../../src/api/entities/VCLCredentialTypesUIFormSchema';
import VCLCredentialTypesUIFormSchemaDescriptor from '../../src/api/entities/VCLCredentialTypesUIFormSchemaDescriptor';
import VCLCountry from '../../src/api/entities/VCLCountry';
import VCLRegions from '../../src/api/entities/VCLRegions';
import VCLRegion from '../../src/api/entities/VCLRegion';
import { VCLCountryCodes } from '../../src';

describe('CredentialTypesUIFormSchemaUseCase Tests', () => {
    let subject: CredentialTypesUIFormSchemaUseCase;
    let mockedCountries: VCLCountries;

    beforeEach(() => {
        mockedCountries = jsonArrToCountries(
            JSON.parse(CredentialTypesUIFormSchemaMocks.CountriesJson)
        );
    });

    test('testCredentialTypesFormSchemaFull', async () => {
        subject = new CredentialTypesUIFormSchemaUseCaseImpl(
            new CredentialTypesUIFormSchemaRepositoryImpl(
                new NetworkServiceSuccess(
                    JSON.parse(
                        CredentialTypesUIFormSchemaMocks.UISchemaFormJsonFull
                    )
                )
            )
        );

        const response = await subject.getCredentialTypesUIFormSchema(
            new VCLCredentialTypesUIFormSchemaDescriptor(
                'some type',
                VCLCountryCodes.CA
            ),
            mockedCountries
        );

        const addressJsonObj = response?.payload.place;
        const addressCountryJsonObj =
            addressJsonObj[VCLCredentialTypesUIFormSchema.KeyAddressCountry];
        const addressRegionJsonObj =
            addressJsonObj[VCLCredentialTypesUIFormSchema.KeyAddressRegion];

        const expectedAddressCountryCodes = JSON.stringify(
            addressCountryJsonObj[VCLCredentialTypesUIFormSchema.KeyUiEnum]
        );
        const expectedAddressCountryNames = JSON.stringify(
            addressCountryJsonObj[VCLCredentialTypesUIFormSchema.KeyUiNames]
        );

        const expectedAddressRegionCodes = JSON.stringify(
            addressRegionJsonObj[VCLCredentialTypesUIFormSchema.KeyUiEnum]
        );
        const expectedAddressRegionNames = JSON.stringify(
            addressRegionJsonObj[VCLCredentialTypesUIFormSchema.KeyUiNames]
        );

        // Assert
        expect(expectedAddressCountryCodes).toEqual(
            CredentialTypesUIFormSchemaMocks.CountryCodes
        );
        expect(expectedAddressCountryNames).toEqual(
            CredentialTypesUIFormSchemaMocks.CountryNames
        );
        expect(expectedAddressRegionCodes).toEqual(
            CredentialTypesUIFormSchemaMocks.CanadaRegionCodes
        );
        expect(expectedAddressRegionNames).toEqual(
            CredentialTypesUIFormSchemaMocks.CanadaRegionNames
        );
    });

    test('testCredentialTypesFormSchemaOnlyCountries', async () => {
        // Arrange
        subject = new CredentialTypesUIFormSchemaUseCaseImpl(
            new CredentialTypesUIFormSchemaRepositoryImpl(
                new NetworkServiceSuccess(
                    JSON.parse(
                        CredentialTypesUIFormSchemaMocks.UISchemaFormJsonOnlyCountries
                    )
                )
            )
        );

        // Action
        const response = await subject.getCredentialTypesUIFormSchema(
            new VCLCredentialTypesUIFormSchemaDescriptor(
                'some type',
                VCLCountryCodes.CA
            ),
            mockedCountries
        );

        const addressJsonObj = response?.payload.place;
        const addressCountryJsonObj =
            addressJsonObj[VCLCredentialTypesUIFormSchema.KeyAddressCountry];
        const addressRegionJsonObj =
            addressJsonObj[VCLCredentialTypesUIFormSchema.KeyAddressRegion];

        const expectedAddressCountryCodes = JSON.stringify(
            addressCountryJsonObj[VCLCredentialTypesUIFormSchema.KeyUiEnum]
        );
        const expectedAddressCountryNames = JSON.stringify(
            addressCountryJsonObj[VCLCredentialTypesUIFormSchema.KeyUiNames]
        );

        const expectedAddressRegionCodes =
            addressRegionJsonObj[VCLCredentialTypesUIFormSchema.KeyUiEnum];
        const expectedAddressRegionNames =
            addressRegionJsonObj[VCLCredentialTypesUIFormSchema.KeyUiNames];

        // Assert
        expect(expectedAddressCountryCodes).toEqual(
            CredentialTypesUIFormSchemaMocks.CountryCodes
        );
        expect(expectedAddressCountryNames).toEqual(
            CredentialTypesUIFormSchemaMocks.CountryNames
        );
        expect(expectedAddressRegionCodes).toBeFalsy();
        expect(expectedAddressRegionNames).toBeFalsy();
    });

    test('testCredentialTypesFormSchemaOnlyRegions', async () => {
        // Arrange
        subject = new CredentialTypesUIFormSchemaUseCaseImpl(
            new CredentialTypesUIFormSchemaRepositoryImpl(
                new NetworkServiceSuccess(
                    JSON.parse(
                        CredentialTypesUIFormSchemaMocks.UISchemaFormJsonOnlyRegions
                    )
                )
            )
        );

        // Action
        const response = await subject.getCredentialTypesUIFormSchema(
            new VCLCredentialTypesUIFormSchemaDescriptor(
                'some type',
                VCLCountryCodes.CA
            ),
            mockedCountries
        );

        const addressJsonObj = response?.payload.place;
        const addressCountryJsonObj =
            addressJsonObj[VCLCredentialTypesUIFormSchema.KeyAddressCountry];
        const addressRegionJsonObj =
            addressJsonObj[VCLCredentialTypesUIFormSchema.KeyAddressRegion];

        const expectedAddressCountryCodes =
            addressCountryJsonObj[VCLCredentialTypesUIFormSchema.KeyUiEnum];
        const expectedAddressCountryNames =
            addressCountryJsonObj[VCLCredentialTypesUIFormSchema.KeyUiNames];

        const expectedAddressRegionCodes = JSON.stringify(
            addressRegionJsonObj[VCLCredentialTypesUIFormSchema.KeyUiEnum]
        );
        const expectedAddressRegionNames = JSON.stringify(
            addressRegionJsonObj[VCLCredentialTypesUIFormSchema.KeyUiNames]
        );

        // Assert
        expect(expectedAddressCountryCodes).toBeFalsy();
        expect(expectedAddressCountryNames).toBeFalsy();
        expect(expectedAddressRegionCodes).toEqual(
            CredentialTypesUIFormSchemaMocks.CanadaRegionCodes
        );
        expect(expectedAddressRegionNames).toEqual(
            CredentialTypesUIFormSchemaMocks.CanadaRegionNames
        );
    });

    test('testCredentialTypesFormSchemaOnlyEnums', async () => {
        // Arrange
        subject = new CredentialTypesUIFormSchemaUseCaseImpl(
            new CredentialTypesUIFormSchemaRepositoryImpl(
                new NetworkServiceSuccess(
                    JSON.parse(
                        CredentialTypesUIFormSchemaMocks.UISchemaFormJsonOnlyEnums
                    )
                )
            )
        );

        // Action
        const response = await subject.getCredentialTypesUIFormSchema(
            new VCLCredentialTypesUIFormSchemaDescriptor(
                'some type',
                VCLCountryCodes.CA
            ),
            mockedCountries
        );

        const addressJsonObj = response?.payload.place;
        const addressCountryJsonObj =
            addressJsonObj[VCLCredentialTypesUIFormSchema.KeyAddressCountry];
        const addressRegionJsonObj =
            addressJsonObj[VCLCredentialTypesUIFormSchema.KeyAddressRegion];

        const expectedAddressCountryCodes = JSON.stringify(
            addressCountryJsonObj[VCLCredentialTypesUIFormSchema.KeyUiEnum]
        );
        const expectedAddressCountryNames =
            addressCountryJsonObj[VCLCredentialTypesUIFormSchema.KeyUiNames];

        const expectedAddressRegionCodes = JSON.stringify(
            addressRegionJsonObj[VCLCredentialTypesUIFormSchema.KeyUiEnum]
        );
        const expectedAddressRegionNames =
            addressRegionJsonObj[VCLCredentialTypesUIFormSchema.KeyUiNames];

        // Assert
        expect(expectedAddressCountryCodes).toEqual(
            CredentialTypesUIFormSchemaMocks.CountryCodes
        );
        expect(expectedAddressCountryNames).toBeFalsy();
        expect(expectedAddressRegionCodes).toEqual(
            CredentialTypesUIFormSchemaMocks.CanadaRegionCodes
        );
        expect(expectedAddressRegionNames).toBeFalsy();
    });

    const jsonArrToCountries = (countriesJsonArr: any[]): VCLCountries => {
        return new VCLCountries(
            countriesJsonArr.map((countryJsonObj) =>
                parseCountry(countryJsonObj)
            )
        );
    };

    const parseCountry = (countryJsonObj: any): VCLCountry => {
        let regions: VCLRegions | null = null;
        if (countryJsonObj.regions) {
            regions = new VCLRegions(
                countryJsonObj.regions.map(
                    (regionObj: any) =>
                        new VCLRegion(regionObj, regionObj.code, regionObj.name)
                )
            );
        }
        return new VCLCountry(
            countryJsonObj,
            countryJsonObj.code,
            countryJsonObj.name,
            regions
        );
    };
});
