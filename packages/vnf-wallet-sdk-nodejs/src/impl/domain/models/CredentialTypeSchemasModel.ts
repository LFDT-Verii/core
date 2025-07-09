import VCLCredentialTypeSchemas from '../../../api/entities/VCLCredentialTypeSchemas';
import Initializable from './Initializable';
import Model from './Model';

export default interface CredentialTypeSchemasModel
    extends Model<VCLCredentialTypeSchemas>,
        Initializable<VCLCredentialTypeSchemas> {}
