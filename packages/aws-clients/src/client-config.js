const buildClientConfig = ({
  apiVersion,
  awsRegion,
  awsEndpoint,
  accessKeyId,
  secretAccessKey,
}) => ({
  apiVersion,
  region: awsRegion,
  ...(awsEndpoint
    ? {
        credentials: {
          accessKeyId: accessKeyId ?? 'tests-key-id',
          secretAccessKey: secretAccessKey ?? 'tests-key',
        },
        endpoint: awsEndpoint,
      }
    : {}),
});

module.exports = {
  buildClientConfig,
};
