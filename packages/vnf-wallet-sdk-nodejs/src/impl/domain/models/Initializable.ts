import VCLError from '../../../api/entities/error/VCLError';

export default interface Initializable<T> {
    initialize(): Promise<VCLError | null>;
}
