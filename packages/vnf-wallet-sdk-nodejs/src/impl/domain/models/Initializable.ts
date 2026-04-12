import VCLError from '../../../api/entities/error/VCLError';

export default interface Initializable {
    initialize(): Promise<VCLError | null>;
}
