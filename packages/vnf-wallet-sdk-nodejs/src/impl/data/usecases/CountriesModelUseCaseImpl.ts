import VCLCountries from '../../../api/entities/VCLCountries';
import CountriesRepository from '../../domain/repositories/CountriesRepository';
import CountriesUseCase from '../../domain/usecases/CountriesModelUseCase';
import VCLError from '../../../api/entities/error/VCLError';

export default class CountriesUseCaseImpl implements CountriesUseCase {
    constructor(private readonly countriesRepository: CountriesRepository) {}

    async getCountries(): Promise<VCLCountries> {
        try {
            return await this.countriesRepository.getCountries();
        } catch (error: any) {
            throw VCLError.fromError(error);
        }
    }
}
