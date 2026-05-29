import VCLCredentialManifestDescriptor from '../../../api/entities/VCLCredentialManifestDescriptor';
import { Nullish } from '../../../api/VCLTypes';

export default interface CredentialManifestRepository {
    getCredentialManifest(
        credentialManifestDescriptor: VCLCredentialManifestDescriptor,
    ): Promise<Nullish<string>>;
}
