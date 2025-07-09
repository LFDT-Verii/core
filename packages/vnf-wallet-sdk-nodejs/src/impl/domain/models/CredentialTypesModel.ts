import VCLCredentialTypes from '../../../api/entities/VCLCredentialTypes';
import Initializable from './Initializable';
import Model from './Model';

export default interface CredentialTypesModel
    extends Model<VCLCredentialTypes>,
        Initializable<VCLCredentialTypes> {}
