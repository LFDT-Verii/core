import VCLCountries from '../../../api/entities/VCLCountries';

export default interface CountriesRepository {
    getCountries(): Promise<VCLCountries>;
}
