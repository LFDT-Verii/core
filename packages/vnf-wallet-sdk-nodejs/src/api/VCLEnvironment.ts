// eslint-disable-next-line no-shadow
enum VCLEnvironment {
    Prod = 'prod',
    Staging = 'staging',
    Qa = 'qa',
    Dev = 'dev',
}

export const environmentFromString = (environment: string): VCLEnvironment => {
    switch (environment.toLowerCase()) {
        case 'prod':
            return VCLEnvironment.Prod;
        case 'staging':
            return VCLEnvironment.Staging;
        case 'qa':
            return VCLEnvironment.Qa;
        case 'dev':
            return VCLEnvironment.Dev;
        default:
            return VCLEnvironment.Prod;
    }
};

export default VCLEnvironment;
