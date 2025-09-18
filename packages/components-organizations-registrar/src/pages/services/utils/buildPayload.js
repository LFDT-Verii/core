import { kebabCase } from 'lodash-es';
import { CREDENTIAL_TYPES_IDS } from '@/utils/serviceTypes.js';
import { getNewServiceIndex } from '@/utils/invitations.js';

const addProp = (name, value) => (value ? { [name]: value } : {});

export const buildPayload = (service, type, did, services) => {
  const kebabType = kebabCase(type);
  const { name, logo, supportedExchangeProtocols, serviceEndpoint } = service;

  const genericPayload = {
    ...(did &&
      services && { id: `${did}#${kebabType}-${getNewServiceIndex(services, kebabType)}` }),
    serviceEndpoint,
    type,
  };
  if (type === CREDENTIAL_TYPES_IDS.VLC_WEB_WALLET_PROVIDER) {
    return {
      ...genericPayload,
      ...addProp('logoUrl', logo),
      ...addProp('supportedExchangeProtocols', supportedExchangeProtocols),
      ...addProp('name', name),
    };
  }
  if (type === CREDENTIAL_TYPES_IDS.VLC_HOLDER_APP_PROVIDER) {
    const { playStoreUrl, googlePlayId, appleAppStoreUrl, appleAppId } = service;
    return {
      ...genericPayload,
      ...addProp('logoUrl', logo),
      ...addProp('supportedExchangeProtocols', supportedExchangeProtocols),
      ...addProp('name', name),
      ...addProp('playStoreUrl', playStoreUrl),
      ...addProp('googlePlayId', googlePlayId),
      ...addProp('appleAppStoreUrl', appleAppStoreUrl),
      ...addProp('appleAppId', appleAppId),
    };
  }
  return genericPayload;
};
