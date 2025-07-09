import VCLCountries from '../../../api/entities/VCLCountries';

export default interface CountriesUseCase {
    getCountries(): Promise<VCLCountries>;
}
