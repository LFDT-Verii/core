import VCLCountries from '../../../api/entities/VCLCountries';
import Initializable from './Initializable';
import Model from './Model';

export default interface CountriesModel
    extends Model<VCLCountries>,
        Initializable<VCLCountries> {}
