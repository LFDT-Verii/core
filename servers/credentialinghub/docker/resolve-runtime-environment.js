const { VELOCITY_NETWORK_PRESETS } = require('./velocity-network-presets');

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

const validateShortcut = (args) => {
  if (args.length > 1) {
    throw new Error('Only one Velocity network shortcut may be supplied');
  }

  const [shortcut] = args;
  if (shortcut != null && !hasOwn(VELOCITY_NETWORK_PRESETS, shortcut)) {
    throw new Error(
      'Unsupported Credentialing Hub image argument. Expected one of: ' +
        Object.keys(VELOCITY_NETWORK_PRESETS).join(', '),
    );
  }

  return shortcut;
};

const findPresetConflicts = (environment, preset) => {
  const ownedNames = new Set(Object.keys(preset));
  return [
    ...Object.keys(preset),
    ...Object.entries(GENERIC_OAUTH_ALIASES)
      .filter(([, hubName]) => ownedNames.has(hubName))
      .map(([genericName]) => genericName),
  ].filter((name) => hasOwn(environment, name));
};

const resolveRuntimeEnvironment = ({ args = [], env = {} }) => {
  const shortcut = validateShortcut(args);

  if (shortcut == null) {
    return applyOAuthAliases(env);
  }

  const preset = VELOCITY_NETWORK_PRESETS[shortcut];
  const conflictingNames = findPresetConflicts(env, preset);

  if (conflictingNames.length > 0) {
    throw new Error(
      `${shortcut} cannot be combined with: ${conflictingNames.join(', ')}`,
    );
  }

  return { ...applyOAuthAliases(env), ...preset };
};

module.exports = { GENERIC_OAUTH_ALIASES, resolveRuntimeEnvironment };
