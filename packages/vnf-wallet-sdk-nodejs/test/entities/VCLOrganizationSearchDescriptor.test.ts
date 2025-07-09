import { VCLFilter, VCLOrganizationsSearchDescriptor } from '../../src';
import { OrganizationsDescriptorMocks } from '../infrastructure/resources/valid/OrganizationsDescriptorMocks';

describe('VCLOrganizationsSearchDescriptor Tests', () => {
    let subject: VCLOrganizationsSearchDescriptor;

    beforeEach(() => {
        // Setup code before each test
    });

    test('testOrganizationsDescriptorAllParamsAggregationSuccess', () => {
        const organizationDescriptorQueryParamsMock =
            'filter.did=did:velocity:0x2bef092530ccc122f5fe439b78eddf6010685e88&' +
            'filter.serviceTypes=Inspector&' +
            'filter.credentialTypes=EducationDegree&' +
            'sort[0]=createdAt,DESC&sort[1]=pdatedAt,ASC&' +
            'page.skip=1&' +
            'page.size=1&q=Bank';
        subject = new VCLOrganizationsSearchDescriptor(
            OrganizationsDescriptorMocks.Filter,
            OrganizationsDescriptorMocks.Page,
            OrganizationsDescriptorMocks.Sort,
            OrganizationsDescriptorMocks.Query
        );

        expect(subject.queryParams).toEqual(
            organizationDescriptorQueryParamsMock
        );
    });

    test('testOrganizationsDescriptorFilterPageSortParamsAggregationSuccess', () => {
        const organizationDescriptorQueryParamsMock =
            'filter.did=did:velocity:0x2bef092530ccc122f5fe439b78eddf6010685e88&' +
            'filter.serviceTypes=Inspector&' +
            'filter.credentialTypes=EducationDegree&' +
            'sort[0]=createdAt,DESC&sort[1]=pdatedAt,ASC&' +
            'page.skip=1&page.size=1';
        subject = new VCLOrganizationsSearchDescriptor(
            OrganizationsDescriptorMocks.Filter,
            OrganizationsDescriptorMocks.Page,
            OrganizationsDescriptorMocks.Sort
        );

        expect(subject.queryParams).toEqual(
            organizationDescriptorQueryParamsMock
        );
    });

    test('testOrganizationsDescriptorFilterPageQueryParamsAggregationSuccess', () => {
        const organizationDescriptorQueryParamsMock =
            'filter.did=did:velocity:0x2bef092530ccc122f5fe439b78eddf6010685e88&' +
            'filter.serviceTypes=Inspector&' +
            'filter.credentialTypes=EducationDegree&' +
            'page.skip=1&' +
            'page.size=1&q=Bank';
        subject = new VCLOrganizationsSearchDescriptor(
            OrganizationsDescriptorMocks.Filter,
            OrganizationsDescriptorMocks.Page,
            null,
            OrganizationsDescriptorMocks.Query
        );

        expect(subject.queryParams).toEqual(
            organizationDescriptorQueryParamsMock
        );
    });

    test('testOrganizationsDescriptorFilterSortQueryParamsAggregationSuccess', () => {
        const organizationDescriptorQueryParamsMock =
            'filter.did=did:velocity:0x2bef092530ccc122f5fe439b78eddf6010685e88&' +
            'filter.serviceTypes=Inspector&' +
            'filter.credentialTypes=EducationDegree&' +
            'sort[0]=createdAt,DESC&' +
            'sort[1]=pdatedAt,ASC&q=Bank';
        subject = new VCLOrganizationsSearchDescriptor(
            OrganizationsDescriptorMocks.Filter,
            null,
            OrganizationsDescriptorMocks.Sort,
            OrganizationsDescriptorMocks.Query
        );

        expect(subject.queryParams).toEqual(
            organizationDescriptorQueryParamsMock
        );
    });

    test('testOrganizationsDescriptorPageSortQueryParamsAggregationSuccess', () => {
        const organizationDescriptorQueryParamsMock =
            'sort[0]=createdAt,DESC&' +
            'sort[1]=pdatedAt,ASC&' +
            'page.skip=1&' +
            'page.size=1&q=Bank';
        subject = new VCLOrganizationsSearchDescriptor(
            null,
            OrganizationsDescriptorMocks.Page,
            OrganizationsDescriptorMocks.Sort,
            OrganizationsDescriptorMocks.Query
        );

        expect(subject.queryParams).toEqual(
            organizationDescriptorQueryParamsMock
        );
    });

    test('testOrganizationsDescriptorDidFilterAggregationSuccess', () => {
        const organizationDescriptorQueryParamsMock =
            'filter.did=did:velocity:0x2bef092530ccc122f5fe439b78eddf6010685e88';
        subject = new VCLOrganizationsSearchDescriptor(
            new VCLFilter(OrganizationsDescriptorMocks.Filter.did)
        );

        expect(subject.queryParams).toEqual(
            organizationDescriptorQueryParamsMock
        );
    });

    test('testOrganizationsDescriptorNoParamsAggregationSuccess', () => {
        const organizationDescriptorQueryParamsMock = null;
        subject = new VCLOrganizationsSearchDescriptor();

        expect(subject.queryParams).toEqual(
            organizationDescriptorQueryParamsMock
        );
    });

    afterEach(() => {
        // Teardown code after each test, if necessary
    });
});
