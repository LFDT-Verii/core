import VCLOrganizations from '../../../api/entities/VCLOrganizations';
import { VCLOrganizationsSearchDescriptor } from '../../../api/entities/VCLOrganizationsSearchDescriptor';

export default interface OrganizationsUseCase {
    searchForOrganizations(
        organizationsSearchDescriptor: VCLOrganizationsSearchDescriptor
    ): Promise<VCLOrganizations>;
}
