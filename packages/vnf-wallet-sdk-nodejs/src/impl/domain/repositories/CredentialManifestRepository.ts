import VCLCredentialManifestDescriptor from '../../../api/entities/VCLCredentialManifestDescriptor';

export default interface CredentialManifestRepository {
    getCredentialManifest(
        credentialManifestDescriptor: VCLCredentialManifestDescriptor
    ): Promise<string>;
}
