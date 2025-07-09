import { useMemo } from 'react';
import { serviceTypesIssuingOrInspection, CREDENTIAL_TYPES_IDS } from '@/utils/serviceTypes';

export const useIsIssuingInspection = (serviceType) => {
  const { isIssuingOrInspection, isCAO } = useMemo(() => {
    const isIssuingOrInspectionType =
      !!serviceType &&
      serviceTypesIssuingOrInspection.some((service) => service.id === serviceType.id);

    const isCAOType =
      !!serviceType && serviceType.id === CREDENTIAL_TYPES_IDS.VLC_CREDENTIAL_AGENT_OPERATOR;

    return { isIssuingOrInspection: isIssuingOrInspectionType, isCAO: isCAOType };
  }, [serviceType]);

  return { isIssuingOrInspection, isCAO };
};

export default useIsIssuingInspection;
