import VCLEnvironment from '../api/VCLEnvironment';
import VCLXVnfProtocolVersion from '../api/VCLXVnfProtocolVersion';

export default class GlobalConfig {
    private static _IsDebugOn = false;

    public static get IsDebugOn() {
        return this._IsDebugOn;
    }

    public static setIsDebugOn(value) {
        this._IsDebugOn = value;
    }

    private static _CurrentEnvironment = VCLEnvironment.Prod;

    public static get CurrentEnvironment() {
        return this._CurrentEnvironment;
    }

    public static setCurrentEnvironment(value) {
        this._CurrentEnvironment = value;
    }

    private static _XVnfProtocolVersion =
        VCLXVnfProtocolVersion.XVnfProtocolVersion1;

    public static get XVnfProtocolVersion() {
        return this._XVnfProtocolVersion;
    }

    public static setXVnfProtocolVersion(value) {
        this._XVnfProtocolVersion = value;
    }

    private static _IsDirectIssuerOn = true;

    public static get IsDirectIssuerOn() {
        return this._IsDirectIssuerOn;
    }

    private static setIsDirectIssuerOn(value) {
        this._IsDirectIssuerOn = value;
    }

    public static init(
        isDebugOn = false,
        currentEnvironment: VCLEnvironment = VCLEnvironment.Prod,
        xVnfProtocolVersion: VCLXVnfProtocolVersion = VCLXVnfProtocolVersion.XVnfProtocolVersion1,
        isDirectIssuerOn = true
    ) {
        GlobalConfig.setIsDebugOn(isDebugOn);
        GlobalConfig.setCurrentEnvironment(currentEnvironment);
        GlobalConfig.setXVnfProtocolVersion(xVnfProtocolVersion);
        GlobalConfig.setIsDirectIssuerOn(isDirectIssuerOn);
    }

    public static get IsLoggerOn() {
        return (
            (this.CurrentEnvironment !== VCLEnvironment.Staging &&
                this.CurrentEnvironment !== VCLEnvironment.Prod) ||
            this.IsDebugOn
        );
    }
}
