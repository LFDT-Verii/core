const GENERIC_OAUTH_ALIASES = Object.freeze({
  BLOCKCHAIN_OAUTH_TOKEN_ENDPOINT: 'VNF_OAUTH_TOKENS_ENDPOINT',
  BLOCKCHAIN_OAUTH_CLIENT_ID: 'VNF_OAUTH_CLIENT_ID',
  BLOCKCHAIN_OAUTH_CLIENT_SECRET: 'VNF_OAUTH_CLIENT_SECRET',
  BLOCKCHAIN_OAUTH_AUDIENCE: 'BLOCKCHAIN_API_AUDIENCE',
});

const NETWORK_SETTINGS_URL =
  'https://github.com/LFDT-Verii/core/blob/main/servers/credentialinghub/README.md#network-settings';

const hasOwn = (object, property) =>
  Object.prototype.hasOwnProperty.call(object, property);

const applyOAuthAliases = (environment) => {
  const resolved = { ...environment };

  for (const [genericName, hubName] of Object.entries(GENERIC_OAUTH_ALIASES)) {
    if (hasOwn(environment, genericName) && hasOwn(environment, hubName)) {
      throw new Error(`${genericName} and ${hubName} cannot both be supplied`);
    }
    if (hasOwn(environment, genericName)) {
      resolved[hubName] = environment[genericName];
    }
  }

  return resolved;
};

// The image took network flags such as --mainnet and --velocity-devnet. It no longer presets
// a network, so it takes no arguments.
const rejectArgs = (args) => {
  if (args.length > 0) {
    throw new Error(
      'Unsupported Credentialing Hub image argument. The image takes no ' +
        'arguments: it no longer presets a network. Set the network values ' +
        `as environment variables. See ${NETWORK_SETTINGS_URL}`,
    );
  }
};

const resolveRuntimeEnvironment = ({ args = [], env = {} }) => {
  rejectArgs(args);
  return applyOAuthAliases(env);
};

module.exports = {
  GENERIC_OAUTH_ALIASES,
  resolveRuntimeEnvironment,
};
