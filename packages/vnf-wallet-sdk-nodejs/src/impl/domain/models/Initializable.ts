import VCLError from '../../../api/entities/error/VCLError';

export default interface Initializable<_T> {
    initialize(): Promise<VCLError | null>;
}
