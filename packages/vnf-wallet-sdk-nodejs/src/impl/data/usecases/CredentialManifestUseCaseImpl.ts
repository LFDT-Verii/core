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
import {
    classifyDidResolution,
    classifyRequestValidation,
    ErrorTaxonomy,
} from '../../utils/ErrorTaxonomy';

export default class CredentialManifestUseCaseImpl implements CredentialManifestUseCase {
    constructor(
        private readonly credentialManifestRepository: CredentialManifestRepository,
        private readonly resolveDidDocumentRepository: ResolveDidDocumentRepository,
        private readonly jwtServiceRepository: JwtServiceRepository,
        private readonly credentialManifestByDeepLinkVerifier: CredentialManifestByDeepLinkVerifier,
    ) {}

    async getCredentialManifest(
        credentialManifestDescriptor: VCLCredentialManifestDescriptor,
        verifiedProfile: VCLVerifiedProfile,
    ): Promise<VCLCredentialManifest> {
        const jwtStr =
            await this.credentialManifestRepository.getCredentialManifest(
                credentialManifestDescriptor,
            );
        if (!jwtStr) {
            throw new VCLError({ message: 'Empty jwtStr' });
        }
        const credentialManifest = this.parseCredentialManifest(
            jwtStr,
            credentialManifestDescriptor,
            verifiedProfile,
        );
        const requestDid = credentialManifest.iss;
        const didDocument = await this.resolveDidDocument(
            credentialManifest,
            requestDid,
        );
        this.validateDidDocumentVerificationMaterial(
            credentialManifest,
            didDocument,
            `public jwk not found for kid: ${credentialManifest.jwt.kid}`,
        );
        try {
            return await this.verifyCredentialManifestJwt(
                credentialManifest,
                didDocument,
            );
        } catch (error) {
            throw classifyRequestValidation(
                VCLError.fromError(error),
                ErrorTaxonomy.RequestKindIssuing,
                requestDid,
            );
        }
    }

    private parseCredentialManifest(
        jwtStr: string,
        credentialManifestDescriptor: VCLCredentialManifestDescriptor,
        verifiedProfile: VCLVerifiedProfile,
    ): VCLCredentialManifest {
        return new VCLCredentialManifest(
            VCLJwt.fromEncodedJwt(jwtStr),
            credentialManifestDescriptor.vendorOriginContext,
            verifiedProfile,
            credentialManifestDescriptor.deepLink,
            credentialManifestDescriptor.didJwk,
            credentialManifestDescriptor.remoteCryptoServicesToken,
        );
    }

    private async resolveDidDocument(
        credentialManifest: VCLCredentialManifest,
        requestDid: string | null,
    ): Promise<VCLDidDocument> {
        try {
            return await this.resolveDidDocumentRepository.resolveDidDocument(
                credentialManifest.iss,
            );
        } catch (error) {
            throw classifyDidResolution(
                VCLError.fromError(error),
                ErrorTaxonomy.RequestKindIssuing,
                requestDid,
            );
        }
    }

    private publicJwkFor(
        credentialManifest: VCLCredentialManifest,
        didDocument: VCLDidDocument,
    ): VCLPublicJwk {
        const { kid } = credentialManifest.jwt;
        if (kid === null) {
            throw new VCLError({
                message: `Empty credentialManifest.jwt.kid in jwt: ${credentialManifest.jwt}`,
            });
        }
        const publicJwk = didDocument.getPublicJwk(kid);
        if (publicJwk === null) {
            throw new VCLError({
                message: `public jwk not found for kid: ${kid}`,
            });
        }
        return publicJwk;
    }

    private resolvePublicJwk(
        credentialManifest: VCLCredentialManifest,
        didDocument: VCLDidDocument,
    ): VCLPublicJwk {
        try {
            return this.publicJwkFor(credentialManifest, didDocument);
        } catch (error) {
            throw classifyRequestValidation(
                VCLError.fromError(error),
                ErrorTaxonomy.RequestKindIssuing,
                credentialManifest.iss,
            );
        }
    }

    private validateDidDocumentVerificationMaterial(
        credentialManifest: VCLCredentialManifest,
        didDocument: VCLDidDocument,
        missingMaterialMessage: string,
    ) {
        const verificationMethod =
            didDocument.payload?.[VCLDidDocument.KeyVerificationMethod];
        if (
            !Array.isArray(verificationMethod) ||
            verificationMethod.length === 0
        ) {
            throw classifyDidResolution(
                new VCLError({
                    message: missingMaterialMessage,
                }),
                ErrorTaxonomy.RequestKindIssuing,
                credentialManifest.iss,
            );
        }
    }

    async verifyCredentialManifestJwt(
        credentialManifest: VCLCredentialManifest,
        didDocument: VCLDidDocument,
    ): Promise<VCLCredentialManifest> {
        const publicJwk = this.resolvePublicJwk(
            credentialManifest,
            didDocument,
        );
        await this.jwtServiceRepository.verifyJwt(
            credentialManifest.jwt,
            publicJwk,
            credentialManifest.remoteCryptoServicesToken,
        );
        return this.verifyCredentialManifestByDeepLink(
            credentialManifest,
            didDocument,
            credentialManifest.deepLink,
        );
    }

    async verifyCredentialManifestByDeepLink(
        credentialManifest: VCLCredentialManifest,
        didDocument: VCLDidDocument,
        deepLink?: Nullish<VCLDeepLink>,
    ): Promise<VCLCredentialManifest> {
        if (credentialManifest.deepLink === null) {
            VCLLog.info('Deep link was not provided => nothing to verify');
            return credentialManifest;
        }
        const isVerified =
            await this.credentialManifestByDeepLinkVerifier.verifyCredentialManifest(
                credentialManifest,
                deepLink!,
                didDocument,
            );
        return this.onVerificationSuccess(isVerified, credentialManifest);
    }

    async onVerificationSuccess(
        isVerified: boolean,
        credentialManifest: VCLCredentialManifest,
    ): Promise<VCLCredentialManifest> {
        if (isVerified) {
            return credentialManifest;
        }
        throw new VCLError({
            message: `Failed to verify credentialManifest jwt:\n${credentialManifest.jwt}`,
        });
    }
}
