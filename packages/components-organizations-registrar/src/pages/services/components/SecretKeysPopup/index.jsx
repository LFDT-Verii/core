import { useCallback, useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import Popup from '@/components/common/Popup.jsx';
import WarningSecretKeysPopup from './WarningSecretKeysPopup/index.jsx';
import { useKeyDownload } from '../../hooks/useKeyDownload';
import { ServiceSecretKeys } from './ServiceSecretKeys/index.jsx';

export const SecretKeysPopup = ({ isOpen, secretKeys, onClose, wording, warningWording }) => {
  const { onDownload, onCopy, isLoadingKeys, isLoadingKeysError, isDownloaded, isCopied } =
    useKeyDownload();

  const [isOpenWarningSecretPopup, setIsOpenWarningSecretPopup] = useState(false);

  const handleClose = useCallback(() => {
    if ((!isCopied && !isDownloaded) || isLoadingKeysError) {
      setIsOpenWarningSecretPopup(true);
    } else {
      onClose();
    }
  }, [isCopied, isDownloaded, isLoadingKeysError, onClose]);

  useEffect(() => {
    if (isOpenWarningSecretPopup && !isLoadingKeys && !isLoadingKeysError && isDownloaded) {
      onClose();
    }
  }, [isOpenWarningSecretPopup, isLoadingKeys, isLoadingKeysError, isDownloaded, onClose]);

  return (
    <Popup
      onClose={handleClose}
      title=""
      isOpen={isOpen}
      mainContainerStyles={styles.mainContainer}
      disableCloseButton={isLoadingKeys}
    >
      <>
        <ServiceSecretKeys
          secretKeys={secretKeys}
          onDownload={onDownload}
          onCopy={onCopy}
          isCopied={isCopied}
          subtitle={wording.title}
          description={wording.subtitle}
        />
        <WarningSecretKeysPopup
          isModalOpened={isOpenWarningSecretPopup}
          onClose={onClose}
          title={warningWording.title}
          subtitle={warningWording.subtitle}
          onClick={() => onDownload(secretKeys)}
          isLoading={isLoadingKeys}
        />
      </>
    </Popup>
  );
};

const styles = {
  mainContainer: { pt: 2 },
};
// eslint-disable-next-line better-mutation/no-mutation
SecretKeysPopup.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  // eslint-disable-next-line react/forbid-prop-types
  secretKeys: PropTypes.object.isRequired,
  onClose: PropTypes.func.isRequired,
  wording: PropTypes.shape({
    title: PropTypes.string.isRequired,
    subtitle: PropTypes.string.isRequired,
  }).isRequired,
  warningWording: PropTypes.shape({
    title: PropTypes.string.isRequired,
    subtitle: PropTypes.string.isRequired,
  }).isRequired,
};

export default SecretKeysPopup;
