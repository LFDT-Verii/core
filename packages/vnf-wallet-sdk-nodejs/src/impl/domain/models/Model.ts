import { Nullish } from '../../../api/VCLTypes';

export default interface Model<T> {
    data: Nullish<T>;
}
