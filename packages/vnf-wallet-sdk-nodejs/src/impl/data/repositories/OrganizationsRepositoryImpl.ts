import { Dictionary, Nullish } from '../../../api/VCLTypes';
import VCLOrganization from '../../../api/entities/VCLOrganization';
import VCLOrganizations from '../../../api/entities/VCLOrganizations';
import { VCLOrganizationsSearchDescriptor } from '../../../api/entities/VCLOrganizationsSearchDescriptor';
import NetworkService from '../../domain/infrastructure/network/NetworkService';
import OrganizationsRepository from '../../domain/repositories/OrganizationsRepository';
import Urls, { HeaderKeys, HeaderValues } from './Urls';
import { HttpMethod } from '../infrastructure/network/HttpMethod';

export default class OrganizationsRepositoryImpl
    implements OrganizationsRepository
{
    constructor(private networkService: NetworkService) {}

    async searchForOrganizations(
        organizationsSearchDescriptor: VCLOrganizationsSearchDescriptor
    ): Promise<VCLOrganizations> {
        const endpoint = organizationsSearchDescriptor.queryParams
            ? `${Urls.Organizations}?${organizationsSearchDescriptor.queryParams}`
            : Urls.Organizations;

        const organizationsResponse = await this.networkService.sendRequest({
            endpoint,
            headers: {
                [HeaderKeys.XVnfProtocolVersion]:
                    HeaderValues.XVnfProtocolVersion,
            },
            method: HttpMethod.GET,
        });
        return this.parse(organizationsResponse.payload);
    }

    private parse(organizationsRaw: Dictionary<any>): VCLOrganizations {
        const organizationsJsonArray: Nullish<Dictionary<any>[]> =
            organizationsRaw[VCLOrganizations.KeyResult];

        const organizations: VCLOrganization[] = (
            organizationsJsonArray ?? []
        ).map((o) => new VCLOrganization(o));

        return new VCLOrganizations(organizations);
    }
}
