import VCLError from '../../api/entities/error/VCLError';

export default class InitializationWatcher {
    private initCount = 0;

    private errors: VCLError[] = [];

    constructor(private readonly initAmount: number) {}

    onInitializedModel(
        error: VCLError | null,
        enforceFailure = false
    ): boolean {
        this.initCount += 1;
        if (error) {
            this.errors = [...this.errors, error]; // Immutable update
        }
        return this.isInitializationComplete(enforceFailure);
    }

    firstError(): VCLError | null {
        return this.errors.length > 0 ? this.errors[0] : null;
    }

    private isInitializationComplete(enforceFailure: boolean): boolean {
        return this.initCount === this.initAmount || enforceFailure;
    }
}
