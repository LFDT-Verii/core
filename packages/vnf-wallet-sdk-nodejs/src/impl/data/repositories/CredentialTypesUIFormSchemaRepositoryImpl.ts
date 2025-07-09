/*
Added the bellow suppression to allow mutating methods like `push`, `pop`, etc.
Alternatively, we could rewrite the code to avoid using mutating methods,
 */
/* eslint-disable better-mutation/no-mutating-methods,better-mutation/no-mutation */
import { Dictionary, Nullish } from '../../../api/VCLTypes';
import VCLCountries from '../../../api/entities/VCLCountries';
import VCLCredentialTypesUIFormSchema from '../../../api/entities/VCLCredentialTypesUIFormSchema';
import VCLCredentialTypesUIFormSchemaDescriptor from '../../../api/entities/VCLCredentialTypesUIFormSchemaDescriptor';
import VCLPlace from '../../../api/entities/VCLPlace';
import VCLRegions from '../../../api/entities/VCLRegions';
import NetworkService from '../../domain/infrastructure/network/NetworkService';
import CredentialTypesUIFormSchemaRepository from '../../domain/repositories/CredentialTypesUIFormSchemaRepository';
import Request from '../infrastructure/network/Request';
import Urls, { HeaderKeys, HeaderValues, Params } from './Urls';
import { HttpMethod } from '../infrastructure/network/HttpMethod';

export default class CredentialTypesUIFormSchemaRepositoryImpl
    implements CredentialTypesUIFormSchemaRepository
{
    constructor(private readonly networkService: NetworkService) {}

    async getCredentialTypesUIFormSchema(
        credentialTypesUIFormSchemaDescriptor: VCLCredentialTypesUIFormSchemaDescriptor,
        countries: VCLCountries
    ): Promise<VCLCredentialTypesUIFormSchema> {
        const credentialTypesFormSchemaResponse =
            await this.networkService.sendRequest({
                endpoint: Urls.CredentialTypesFormSchema.replace(
                    Params.CredentialType,
                    credentialTypesUIFormSchemaDescriptor.credentialType
                ),
                method: HttpMethod.GET,
                contentType: Request.ContentTypeApplicationJson,
                headers: {
                    [HeaderKeys.XVnfProtocolVersion]:
                        HeaderValues.XVnfProtocolVersion,
                },
                useCaches: true,
                body: null,
            });

        const country = countries.countryByCode(
            credentialTypesUIFormSchemaDescriptor.countryCode
        );

        return new VCLCredentialTypesUIFormSchema(
            this.parseCredentialTypesUIFormSchema(
                countries,
                credentialTypesFormSchemaResponse?.payload,
                country?.regions
            )
        );
    }

    // eslint-disable-next-line complexity
    private parseCredentialTypesUIFormSchema(
        countries: VCLCountries,
        formSchemaDict: Dictionary<any>,
        regions: Nullish<VCLRegions>
    ): Dictionary<any> {
        let formSchemaDictCP = JSON.parse(JSON.stringify(formSchemaDict));
        for (const key of Object.keys(formSchemaDictCP)) {
            const valueDict = formSchemaDictCP[key];
            if (typeof valueDict === 'object') {
                // eslint-disable-next-line max-depth
                if (key === VCLCredentialTypesUIFormSchema.KeyAddressCountry) {
                    const allCountries = countries.all;
                    // eslint-disable-next-line max-depth
                    if (allCountries) {
                        formSchemaDictCP = this.updateAddressEnums(
                            allCountries,
                            key,
                            valueDict,
                            formSchemaDictCP
                        );
                    }
                } else if (
                    key === VCLCredentialTypesUIFormSchema.KeyAddressRegion
                ) {
                    const allRegions = regions?.all;
                    // eslint-disable-next-line max-depth
                    if (allRegions) {
                        formSchemaDictCP = this.updateAddressEnums(
                            allRegions,
                            key,
                            valueDict,
                            formSchemaDictCP
                        );
                    }
                } else {
                    formSchemaDictCP[key] =
                        this.parseCredentialTypesUIFormSchema(
                            countries,
                            valueDict,
                            regions
                        );
                }
            }
        }
        return formSchemaDictCP;
    }

    private updateAddressEnums(
        places: VCLPlace[],
        key: string,
        valueDict: Dictionary<any>,
        formSchemaDict: Dictionary<any>
    ): Dictionary<any> {
        const formSchemaDictCP = JSON.parse(JSON.stringify(formSchemaDict));
        const valueDictHasKeyUiEnum = Object.keys(valueDict).includes(
            VCLCredentialTypesUIFormSchema.KeyUiEnum
        );
        const valueDictHasKeyUiNames = Object.keys(valueDict).includes(
            VCLCredentialTypesUIFormSchema.KeyUiNames
        );

        if (valueDictHasKeyUiEnum || valueDictHasKeyUiNames) {
            const uiEnumArr: any[] = [];
            const uiNamesArr: any[] = [];
            places.forEach((place) => {
                if (valueDictHasKeyUiEnum) {
                    uiEnumArr.push(place.code);
                }
                if (valueDictHasKeyUiNames) {
                    uiNamesArr.push(place.name);
                }
            });
            if (valueDictHasKeyUiEnum) {
                valueDict[VCLCredentialTypesUIFormSchema.KeyUiEnum] = uiEnumArr;
            }
            if (valueDictHasKeyUiNames) {
                valueDict[VCLCredentialTypesUIFormSchema.KeyUiNames] =
                    uiNamesArr;
            }
            formSchemaDictCP[key] = valueDict;
        }
        return formSchemaDictCP;
    }
}
