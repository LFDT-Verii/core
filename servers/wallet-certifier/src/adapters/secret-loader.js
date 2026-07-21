const {
  GetSecretValueCommand,
  SecretsManagerClient,
} = require('@aws-sdk/client-secrets-manager');

const parseSecret = (secretString) => {
  const secret = JSON.parse(secretString);
  for (const name of [
    'mongoConnectionString',
    'hubOperatorToken',
    'capabilityPepper',
  ]) {
    if (!secret[name]) {
      throw new Error(`Wallet Certifier secret is missing ${name}`);
    }
  }
  return secret;
};

const loadSecrets = async (
  config,
  client = new SecretsManagerClient({}),
  env = process.env,
) => {
  if (!config.secretsArn) {
    return parseSecret(
      JSON.stringify({
        mongoConnectionString: env.MONGO_URI,
        hubOperatorToken: env.CREDENTIALING_HUB_OPERATOR_TOKEN,
        capabilityPepper: env.CAPABILITY_PEPPER,
      }),
    );
  }

  const response = await client.send(
    new GetSecretValueCommand({ SecretId: config.secretsArn }),
  );
  return parseSecret(response.SecretString);
};

module.exports = { loadSecrets, parseSecret };
