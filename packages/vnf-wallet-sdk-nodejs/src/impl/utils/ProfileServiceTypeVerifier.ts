import VCLError from '../../api/entities/error/VCLError';
import VCLServiceTypes from '../../api/entities/VCLServiceTypes';
import VCLStatusCode from '../../api/entities/error/VCLStatusCode';
import VCLVerifiedProfile from '../../api/entities/VCLVerifiedProfile';
import VCLVerifiedProfileDescriptor from '../../api/entities/VCLVerifiedProfileDescriptor';
import VerifiedProfileUseCase from '../domain/usecases/VerifiedProfileUseCase';
import VCLErrorCode from '../../api/entities/error/VCLErrorCode';
import { Dictionary, Nullish } from '../../api/VCLTypes';
import VCLLog from './VCLLog';

export class ProfileServiceTypeVerifier {
    constructor(
        private readonly verifiedProfileUseCase: VerifiedProfileUseCase
    ) {}

    async verifyServiceTypeOfVerifiedProfile(
        verifiedProfileDescriptor: VCLVerifiedProfileDescriptor,
        expectedServiceTypes: VCLServiceTypes
    ): Promise<VCLVerifiedProfile> {
        const verifiedProfile =
            await this.verifiedProfileUseCase.getVerifiedProfile(
                verifiedProfileDescriptor
            );

        await this.verifyServiceType(verifiedProfile, expectedServiceTypes);

        return verifiedProfile;
    }

    toJsonString(
        profileName: Nullish<string>,
        message: Nullish<string>
    ): string {
        try {
            const jsonObject: Dictionary<any> = {};
            if (profileName !== null) {
                jsonObject.profileName = profileName;
            }
            if (message !== null) {
                jsonObject.message = message;
            }
            return JSON.stringify(jsonObject);
        } catch (e) {
            VCLLog.error(e);
        }
        return `${profileName} ${message}`;
    }

    async verifyServiceType(
        verifiedProfile: VCLVerifiedProfile,
        expectedServiceTypes: VCLServiceTypes
    ): Promise<boolean> {
        if (
            verifiedProfile.serviceTypes.containsAtLeastOneOf(
                expectedServiceTypes
            )
        ) {
            return true;
        }
        throw new VCLError(
            null,
            VCLErrorCode.SdkError.toString(),
            null,
            this.toJsonString(
                verifiedProfile.name,
                `Wrong service type - expected: ${expectedServiceTypes.all}, found: ${verifiedProfile.serviceTypes.all}`
            ),
            VCLStatusCode.VerificationError
        );
    }
}
