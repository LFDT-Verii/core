import VCLOrganizations from '../../../api/entities/VCLOrganizations';
import { VCLOrganizationsSearchDescriptor } from '../../../api/entities/VCLOrganizationsSearchDescriptor';

export default interface OrganizationsRepository {
    searchForOrganizations(
        organizationsSearchDescriptor: VCLOrganizationsSearchDescriptor
    ): Promise<VCLOrganizations>;
}
