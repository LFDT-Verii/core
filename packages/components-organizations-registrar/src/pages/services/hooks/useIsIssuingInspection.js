import { useMemo } from 'react';
import { serviceTypesIssuingOrInspection, CREDENTIAL_TYPES_IDS } from '@/utils/serviceTypes.js';

export const useIsIssuingInspection = (serviceType) => {
  const serviceGroup = useMemo(() => {
    const isIssuingOrInspection =
      !!serviceType &&
      serviceTypesIssuingOrInspection.some((service) => service.id === serviceType.id);

    const isCAO =
      !!serviceType && serviceType.id === CREDENTIAL_TYPES_IDS.VLC_CREDENTIAL_AGENT_OPERATOR;

    const isWebWallet =
      !!serviceType && serviceType.id === CREDENTIAL_TYPES_IDS.VLC_WEB_WALLET_PROVIDER;

    const isHolderWallet =
      !!serviceType && serviceType.id === CREDENTIAL_TYPES_IDS.VLC_HOLDER_APP_PROVIDER;

    const isWallet = isWebWallet || isHolderWallet;

    return { isIssuingOrInspection, isCAO, isWallet, isHolderWallet, isWebWallet };
  }, [serviceType]);

  return { ...serviceGroup };
};

export default useIsIssuingInspection;
