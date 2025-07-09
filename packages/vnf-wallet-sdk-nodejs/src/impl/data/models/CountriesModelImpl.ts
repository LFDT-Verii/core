import VCLCountries from '../../../api/entities/VCLCountries';
import VCLError from '../../../api/entities/error/VCLError';
import CountriesModel from '../../domain/models/CountriesModel';
import CountriesUseCase from '../../domain/usecases/CountriesModelUseCase';
import { Nullish } from '../../../api/VCLTypes';

export default class CountriesModelImpl implements CountriesModel {
    constructor(private readonly countriesUseCase: CountriesUseCase) {}

    public data: Nullish<VCLCountries>;

    async initialize(): Promise<VCLError | null> {
        this.data = await this.countriesUseCase.getCountries();
        return null;
    }
}
