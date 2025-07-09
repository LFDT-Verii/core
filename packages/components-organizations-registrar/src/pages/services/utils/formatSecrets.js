export const formatSecrets = (secretKeys) => {
  return secretKeys
    ? [
        ...(secretKeys.keys
          ? secretKeys.keys.map((item) => ({
              ...item,
              id: item.didDocumentKey.id.replace('#', ''),
            }))
          : []),
        ...(secretKeys.authClients
          ? secretKeys.authClients.reduce(
              (acc, { clientId, clientSecret }) => [
                ...acc,
                { id: 'Client Id', key: clientId },
                { id: 'Client Secret', key: clientSecret },
              ],
              [],
            )
          : []),
      ]
    : [];
};
