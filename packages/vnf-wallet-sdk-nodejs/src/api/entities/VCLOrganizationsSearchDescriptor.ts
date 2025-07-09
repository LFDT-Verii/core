// eslint-disable-next-line max-classes-per-file
import { Nullish } from '../VCLTypes';
import VCLServiceTypes from './VCLServiceTypes';

export class VCLOrganizationsSearchDescriptor {
    constructor(
        public readonly filter: Nullish<VCLFilter> = null,
        public readonly page: Nullish<VCLPage> = null,
        /**
         * A array of tuples indicating the field to sort by
         */
        public readonly sort: Nullish<string[][]> = null,
        /**
         * Full Text search for the name property of the organization
         * Matches on partials strings
         * Prefer results that are the first word of the name, or first letter of a word
         */
        public readonly query: Nullish<string> = null
    ) {}

    public readonly queryParams = this.generateQueryParams();

    // eslint-disable-next-line complexity
    private generateQueryParams(): Nullish<string> {
        const pFilterDid =
            this.filter?.did &&
            `${VCLOrganizationsSearchDescriptor.KeyFilterDid}=${this.filter.did}`;

        const pFilterServiceTypes =
            this.filter?.serviceTypes?.all &&
            `${
                VCLOrganizationsSearchDescriptor.KeyFilterServiceTypes
            }=${this.filter.serviceTypes.all
                .map((i) => encodeURIComponent(i))
                .join(',')}`;
        const pFilterCredentialTypes =
            this.filter?.credentialTypes &&
            `${
                VCLOrganizationsSearchDescriptor.KeyFilterCredentialTypes
            }=${this.filter.credentialTypes
                .map((credentialType) => encodeURIComponent(credentialType))
                .join(',')}`;
        const pSort = this.sort
            ?.map(
                (list, index) =>
                    `${
                        VCLOrganizationsSearchDescriptor.KeySort
                    }[${index}]=${list.join(',')}`
            )
            ?.join('&');
        const pPageSkip =
            this.page?.skip &&
            `${
                VCLOrganizationsSearchDescriptor.KeyPageSkip
            }=${encodeURIComponent(this.page.skip)}`;
        const pPageSize =
            this.page?.size &&
            `${
                VCLOrganizationsSearchDescriptor.KeyPageSize
            }=${encodeURIComponent(this.page.size)}`;

        const pQuery =
            this.query &&
            `${VCLOrganizationsSearchDescriptor.KeyQueryQ}=${encodeURIComponent(
                this.query
            )}`;

        const qParams = [
            pFilterDid,
            pFilterServiceTypes,
            pFilterCredentialTypes,
            pSort,
            pPageSkip,
            pPageSize,
            pQuery,
        ].filter((qParam) => !!qParam);
        return qParams.length === 0 ? null : qParams.join('&');
    }

    static readonly KeyQueryQ = 'q';

    static readonly KeySort = 'sort';

    static readonly KeyFilterDid = 'filter.did';

    static readonly KeyFilterServiceTypes = 'filter.serviceTypes';

    static readonly KeyFilterCredentialTypes = 'filter.credentialTypes';

    static readonly KeyPageSkip = 'page.skip';

    static readonly KeyPageSize = 'page.size';
}

export class VCLFilter {
    constructor(
        /**
         * Filters organizations based on DIDs
         */
        public readonly did: Nullish<string> = null,
        /**
         * Filters organizations based on Service Types e.g. [VCLServiceType]
         */
        public readonly serviceTypes: Nullish<VCLServiceTypes> = null,
        /**
         * Filters organizations based on credential types e.g. [EducationDegree]
         */
        public readonly credentialTypes: Nullish<string[]> = null
    ) {}
}

export class VCLPage {
    constructor(
        /**
         * The number of records to retrieve
         */
        public readonly size: Nullish<string> = null,
        /**
         * The objectId to skip
         */
        public readonly skip: Nullish<string> = null
    ) {}
}
