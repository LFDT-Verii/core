import { useEffect, useState } from 'react';
import { useConfig } from '@/utils/ConfigContext';

/**
 * useSignatoryResponse hook
 * @param {string} did
 * @param {string} authCode
 * @param {string} response
 * @returns {Object} { isLoading, errorCode }
 */
export const useSignatoryResponse = ({ did, authCode, response }) => {
  const config = useConfig();

  const [isLoading, setIsLoading] = useState(false);
  const [errorCode, setErrorCode] = useState(null);

  useEffect(() => {
    const addResponse = async () => {
      setIsLoading(true);
      setErrorCode(null);
      try {
        const resp = await fetch(
          `${config.registrarApi}/organizations/${did}/signatories/response/${response}?authCode=${authCode}`,
        );
        if (!resp.ok) {
          const data = await resp.json();
          setErrorCode(data?.errorCode || null);
        }
      } catch (e) {
        setErrorCode(e?.errorCode || null);
      } finally {
        setIsLoading(false);
      }
    };
    if (did && authCode && response && config.registrarApi) {
      addResponse();
    }
  }, [did, authCode, response, config.registrarApi]);

  return { isLoading, errorCode };
};

export default useSignatoryResponse;
