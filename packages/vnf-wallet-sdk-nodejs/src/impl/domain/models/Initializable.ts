import VCLError from '../../../api/entities/error/VCLError';

// eslint-disable-next-line
export default interface Initializable<T> {
    initialize(): Promise<VCLError | null>;
}
