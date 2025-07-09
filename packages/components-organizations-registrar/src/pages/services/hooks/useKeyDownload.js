import { useState, useCallback } from 'react';
import downloadTxtAsFile from '@/utils/downloadTxtAsFile';
import { copyTextToClipboard, objectToString } from '@/utils/index.jsx';

export const useKeyDownload = () => {
  const [isDownloaded, setIsDownloaded] = useState(false);
  const [isLoadingKeys, setIsLoadingKeys] = useState(false);
  const [isLoadingKeysError, setIsLoadingKeysError] = useState(false);
  const [isCopied, setIsCopied] = useState(false);

  const onCopy = useCallback((secretKeys) => {
    copyTextToClipboard(objectToString(secretKeys), (error) => {
      setIsCopied(!error);
    });
  }, []);

  const onDownload = useCallback((secretKeys) => {
    setIsLoadingKeys(true);
    const keys = objectToString(secretKeys);
    downloadTxtAsFile(
      'keys.json',
      keys,
      (isLoading) => setIsLoadingKeys(isLoading),
      (isError) => setIsLoadingKeysError(isError),
      (isClicked) => setIsDownloaded(isClicked),
    );
  }, []);

  return { isDownloaded, isLoadingKeys, isLoadingKeysError, isCopied, onDownload, onCopy };
};

export default useKeyDownload;
