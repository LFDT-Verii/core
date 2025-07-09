import { required, maxLength, email } from 'react-admin';
import { authorityOptions } from '@/constants/messageCodes';

export const validateName = [required(), maxLength(100)];
export const validateEmail = [required(), email()];

export const getSellSizeIfLocalAuthority = (authority) => {
  if (authorityOptions[authority] === authorityOptions.NationalAuthority) {
    return 6;
  }
  return 12;
};

export const requestOptions = {
  retryOnMount: false,
  refetchOnWindowFocus: false,
  refetchOnReconnect: false,
  refetchOnMount: false,
};

export const organizationPlaceholder =
  'Add a few words describing your organization (boilerplate text) so that other Network participants can learn about it.';
