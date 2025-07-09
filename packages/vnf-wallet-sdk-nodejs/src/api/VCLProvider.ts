import { VCLImpl } from '../impl/VCLImpl';
import VCL from './VCL';

export default class VCLProvider {
    private static vclInstance: VCL | null = null;

    private constructor() {
        // prevent external instantiation
    }

    public static getInstance(): VCL {
        if (VCLProvider.vclInstance === null) {
            // eslint-disable-next-line better-mutation/no-mutation
            VCLProvider.vclInstance = new VCLImpl();
        }
        return VCLProvider.vclInstance;
    }
}
