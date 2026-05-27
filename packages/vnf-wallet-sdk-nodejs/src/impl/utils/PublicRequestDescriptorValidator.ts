import VCLDeepLink from '../../api/entities/VCLDeepLink';
import VCLError from '../../api/entities/error/VCLError';
import VCLErrorCode from '../../api/entities/error/VCLErrorCode';
import { Nullish } from '../../api/VCLTypes';
import { ErrorTaxonomy, RequestKind } from './ErrorTaxonomy';
import VelocityDeepLinkValidator from './VelocityDeepLinkValidator';

type PublicRequestDescriptor = {
    deepLink: Nullish<VCLDeepLink>;
    endpoint: Nullish<string>;
    did: Nullish<string>;
};

type PublicRequestDescriptorValidatorConfig = {
    requestKind: RequestKind;
    expectedPath: string;
    requireDeepLink: boolean;
};

export default class PublicRequestDescriptorValidator {
    constructor(
        private readonly config: PublicRequestDescriptorValidatorConfig,
        private readonly deepLinkValidator = new VelocityDeepLinkValidator(),
    ) {}

    validate(descriptor: PublicRequestDescriptor) {
        const { requestKind, expectedPath, requireDeepLink } = this.config;
        if (requireDeepLink && !descriptor.deepLink) {
            throw new VCLError({
                errorCode: VCLErrorCode.InvalidLink,
                message: `deepLink was not found in ${JSON.stringify(descriptor)}`,
                validationPhase: ErrorTaxonomy.PhaseLinkValidation,
                requestKind,
            });
        }
        if (requireDeepLink || descriptor.deepLink) {
            this.throwIfValidationError(
                this.deepLinkValidator.validateDeepLink({
                    deepLink: descriptor.deepLink!,
                    expectedPath,
                    requestKind,
                }),
            );
        }
        this.throwIfValidationError(
            this.deepLinkValidator.validateRequestEndpoint(
                descriptor.endpoint,
                requestKind,
            ),
        );
        if (!descriptor.did) {
            throw new VCLError({
                errorCode: VCLErrorCode.InvalidLink,
                message: `did was not found in ${JSON.stringify(descriptor)}`,
                validationPhase: ErrorTaxonomy.PhaseLinkValidation,
                requestKind,
            });
        }
    }

    private throwIfValidationError(error: VCLError | null) {
        if (error) {
            throw error;
        }
    }
}
