// Each image flag selects a NETWORK, whose presets @verii/config applies.
// The --velocity-* flags are the earlier names.
const NETWORK_FLAGS = Object.freeze({
  '--devnet': 'devnet',
  '--testnet': 'testnet',
  '--mainnet': 'mainnet',
  '--no-preset': 'no-preset',
  '--velocity-devnet': 'devnet',
  '--velocity-testnet': 'testnet',
  '--velocity-mainnet': 'mainnet',
});

const GENERIC_OAUTH_ALIASES = Object.freeze({
  BLOCKCHAIN_OAUTH_TOKEN_ENDPOINT: 'VNF_OAUTH_TOKENS_ENDPOINT',
  BLOCKCHAIN_OAUTH_CLIENT_ID: 'VNF_OAUTH_CLIENT_ID',
  BLOCKCHAIN_OAUTH_CLIENT_SECRET: 'VNF_OAUTH_CLIENT_SECRET',
  BLOCKCHAIN_OAUTH_AUDIENCE: 'BLOCKCHAIN_API_AUDIENCE',
});

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

const validateFlag = (args) => {
  if (args.length > 1) {
    throw new Error('Only one network flag may be supplied');
  }

  const [flag] = args;
  if (flag != null && !hasOwn(NETWORK_FLAGS, flag)) {
    throw new Error(
      'Unsupported Credentialing Hub image argument. Expected one of: ' +
        '--devnet, --testnet, --mainnet, --no-preset',
    );
  }

  return flag;
};

const resolveRuntimeEnvironment = ({ args = [], env = {} }) => {
  const flag = validateFlag(args);
  const resolved = applyOAuthAliases(env);

  if (flag == null) {
    return resolved;
  }

  const network = NETWORK_FLAGS[flag];
  if (hasOwn(env, 'NETWORK') && env.NETWORK !== network) {
    throw new Error(`${flag} can't be combined with NETWORK=${env.NETWORK}`);
  }

  return { ...resolved, NETWORK: network };
};

module.exports = {
  GENERIC_OAUTH_ALIASES,
  NETWORK_FLAGS,
  resolveRuntimeEnvironment,
};
