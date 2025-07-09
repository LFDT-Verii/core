import VCLCredentialManifest from '../../../api/entities/VCLCredentialManifest';
import VCLCredentialManifestDescriptor from '../../../api/entities/VCLCredentialManifestDescriptor';
import VCLError from '../../../api/entities/error/VCLError';
import VCLPublicJwk from '../../../api/entities/VCLPublicJwk';
import VCLJwt from '../../../api/entities/VCLJwt';
import CredentialManifestRepository from '../../domain/repositories/CredentialManifestRepository';
import JwtServiceRepository from '../../domain/repositories/JwtServiceRepository';
import CredentialManifestUseCase from '../../domain/usecases/CredentialManifestUseCase';
import VCLVerifiedProfile from '../../../api/entities/VCLVerifiedProfile';
import CredentialManifestByDeepLinkVerifier from '../../domain/verifiers/CredentialManifestByDeepLinkVerifier';
import VCLLog from '../../utils/VCLLog';
import VCLDidDocument from '../../../api/entities/VCLDidDocument';
import ResolveDidDocumentRepository from '../../domain/repositories/ResolveDidDocumentRepository';
import VCLDeepLink from '../../../api/entities/VCLDeepLink';
import { Nullish } from '../../../api/VCLTypes';

export default class CredentialManifestUseCaseImpl
    implements CredentialManifestUseCase
{
    constructor(
        private readonly credentialManifestRepository: CredentialManifestRepository,
        private readonly resolveDidDocumentRepository: ResolveDidDocumentRepository,
        private readonly jwtServiceRepository: JwtServiceRepository,
        private readonly credentialManifestByDeepLinkVerifier: CredentialManifestByDeepLinkVerifier
    ) {}

    async getCredentialManifest(
        credentialManifestDescriptor: VCLCredentialManifestDescriptor,
        verifiedProfile: VCLVerifiedProfile
    ): Promise<VCLCredentialManifest> {
        const jwtStr =
            await this.credentialManifestRepository.getCredentialManifest(
                credentialManifestDescriptor
            );
        if (jwtStr) {
            const credentialManifest = new VCLCredentialManifest(
                VCLJwt.fromEncodedJwt(jwtStr!),
                credentialManifestDescriptor.vendorOriginContext,
                verifiedProfile,
                credentialManifestDescriptor.deepLink,
                credentialManifestDescriptor.didJwk,
                credentialManifestDescriptor.remoteCryptoServicesToken
            );
            const didDocument =
                await this.resolveDidDocumentRepository.resolveDidDocument(
                    credentialManifest.iss
                );
            const { kid } = credentialManifest.jwt;
            if (kid === null) {
                throw new VCLError(
                    `Empty credentialManifest.jwt.kid in jwt: ${credentialManifest.jwt}`
                );
            }
            const publicJwk = didDocument.getPublicJwk(kid);
            if (publicJwk === null) {
                throw new VCLError(`public jwk not found for kid: ${kid}`);
            }
            return this.verifyCredentialManifestJwt(
                publicJwk,
                credentialManifest,
                didDocument
            );
        }
        throw new VCLError('Empty jwtStr');
    }

    async verifyCredentialManifestJwt(
        publicJwk: VCLPublicJwk,
        credentialManifest: VCLCredentialManifest,
        didDocument: VCLDidDocument
    ): Promise<VCLCredentialManifest> {
        await this.jwtServiceRepository.verifyJwt(
            credentialManifest.jwt,
            publicJwk,
            credentialManifest.remoteCryptoServicesToken
        );
        return this.verifyCredentialManifestByDeepLink(
            credentialManifest,
            didDocument,
            credentialManifest.deepLink
        );
    }

    async verifyCredentialManifestByDeepLink(
        credentialManifest: VCLCredentialManifest,
        didDocument: VCLDidDocument,
        deepLink?: Nullish<VCLDeepLink>
    ): Promise<VCLCredentialManifest> {
        if (credentialManifest.deepLink === null) {
            VCLLog.info('Deep link was not provided => nothing to verify');
            return credentialManifest;
        }
        const isVerified =
            await this.credentialManifestByDeepLinkVerifier.verifyCredentialManifest(
                credentialManifest,
                deepLink!,
                didDocument
            );
        return this.onVerificationSuccess(isVerified, credentialManifest);
    }

    async onVerificationSuccess(
        isVerified: boolean,
        credentialManifest: VCLCredentialManifest
    ): Promise<VCLCredentialManifest> {
        if (isVerified) {
            return credentialManifest;
        }
        throw new VCLError(
            `Failed to verify credentialManifest jwt:\n${credentialManifest.jwt}`
        );
    }
}
