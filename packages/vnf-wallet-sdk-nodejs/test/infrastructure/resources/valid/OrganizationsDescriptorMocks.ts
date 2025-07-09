import {
    VCLFilter,
    VCLPage,
} from '../../../../src/api/entities/VCLOrganizationsSearchDescriptor';
import VCLServiceType from '../../../../src/api/entities/VCLServiceType';
import VCLServiceTypes from '../../../../src/api/entities/VCLServiceTypes';

class OrganizationsDescriptorMocks {
    static Filter = new VCLFilter(
        'did:velocity:0x2bef092530ccc122f5fe439b78eddf6010685e88',
        new VCLServiceTypes([VCLServiceType.Inspector]),
        ['EducationDegree']
    );

    static Page = new VCLPage('1', '1');

    static Sort = [
        ['createdAt', 'DESC'],
        ['pdatedAt', 'ASC'],
    ];

    static Query = 'Bank';
}

export { OrganizationsDescriptorMocks };
