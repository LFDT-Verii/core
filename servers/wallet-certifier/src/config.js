const asRequired = (env, name) => {
  const value = env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
};

const asUrl = (env, name) => {
  const value = asRequired(env, name);
  return new URL(value).toString().replace(/\/$/, '');
};

const valueOrDefault = (env, name, fallback) => env[name] ?? fallback;
const numberOrDefault = (env, name, fallback) =>
  Number(valueOrDefault(env, name, fallback));
const optionalUrl = (value) => (value ? new URL(value).toString() : undefined);

const loadConfig = (env = process.env) => ({
  nodeEnv: valueOrDefault(env, 'NODE_ENV', 'development'),
  host: valueOrDefault(env, 'HOST', '0.0.0.0'),
  port: numberOrDefault(env, 'PORT', 14081),
  logSeverity: valueOrDefault(env, 'LOG_SEVERITY', 'info'),
  bodyLimit: numberOrDefault(env, 'BODY_LIMIT', 64 * 1024),
  environmentName: valueOrDefault(env, 'ENVIRONMENT_NAME', 'local'),
  brandName: valueOrDefault(env, 'BRAND_NAME', 'Velocity Network Foundation'),
  logoUrl: env.LOGO_URL,
  publicAppUrl: asUrl(env, 'PUBLIC_APP_URL'),
  registrationUrl: asUrl(env, 'WALLET_REGISTRATION_URL'),
  registrarUrl: asUrl(env, 'REGISTRAR_URL'),
  hubUrl: asUrl(env, 'CREDENTIALING_HUB_URL'),
  tenantId: asRequired(env, 'CREDENTIALING_HUB_TENANT_ID'),
  issuerServiceId: asRequired(env, 'CREDENTIALING_HUB_ISSUER_SERVICE_ID'),
  relyingPartyServiceId: asRequired(
    env,
    'CREDENTIALING_HUB_RELYING_PARTY_SERVICE_ID',
  ),
  supportEmail: asRequired(env, 'SUPPORT_EMAIL'),
  senderEmail: asRequired(env, 'SENDER_EMAIL'),
  awsRegion: valueOrDefault(env, 'AWS_REGION', 'us-east-1'),
  awsEndpoint: optionalUrl(env.AWS_ENDPOINT),
  achievementId: asUrl(env, 'BADGE_ACHIEVEMENT_ID'),
  badgeImageUrl: optionalUrl(env.BADGE_IMAGE_URL),
  badgeCriteriaUrl: optionalUrl(env.BADGE_CRITERIA_URL),
  secretsArn: env.WALLET_CERTIFIER_SECRETS_ARN,
  databaseName: valueOrDefault(env, 'MONGO_DB_NAME', 'wallet_certifier'),
});

module.exports = { loadConfig };
