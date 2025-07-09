/**
 * Copyright 2023 Velocity Team
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { useMemo, useState } from 'react';
import { Box, Typography, Button, Grid, Stack } from '@mui/material';
import { Form, useRedirect } from 'react-admin';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import InfoIcon from '@mui/icons-material/Info';
import DownloadIcon from '@mui/icons-material/Download';
import PropTypes from 'prop-types';

import { copyTextToClipboard, objectToString } from '../../utils/index.jsx';
import downloadTxtAsFile from '../../utils/downloadTxtAsFile';
import Popup from '../../components/common/Popup.jsx';

const SecretKeysPopup = ({
  isModalOpened,
  secretKeys,
  onClose,
  isSecureTransfare,
  isTransferConfirmed,
  onShowWarning,
}) => {
  const [isCopied, setIsCopied] = useState(false);
  const [isDownloaded, setIsDownloaded] = useState(false);
  const [isLoadingKeys, setIsLoadingKeys] = useState(false);
  const [isLoadingKeysError, setIsLoadingKeysError] = useState(false);
  const redirect = useRedirect();

  const formattedSecrets = useMemo(() => {
    return secretKeys
      ? [
          ...secretKeys.keys.map((item) => ({
            ...item,
            id: item.didDocumentKey.id.replace('#', ''),
          })),
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
  }, [secretKeys]);

  const onCopy = () => {
    copyTextToClipboard(objectToString(secretKeys), (err) => {
      setIsCopied(!err);
    });
  };

  const handleClose = () => {
    if ((!isCopied && !isDownloaded) || isLoadingKeysError) {
      onClose();
      onShowWarning();
    } else {
      onClose();
      redirect('/');
    }
  };

  return (
    <Popup
      onClose={handleClose}
      title="Congratulations!"
      isOpen={isModalOpened}
      mainContainerStyles={{ p: '48px 0 0 0' }}
      titleStyles={{ pl: '48px' }}
      disableCloseButton={isLoadingKeys}
    >
      <Box sx={{ px: 6 }}>
        <Typography variant="h4" sx={styles.congratulationsText}>
          Your organization is now registered on Velocity Network™.
        </Typography>
        <Typography variant="pl" fontWeight={600}>
          Please save your organization’s unique keys in a secure location, as they will not be
          available once you close this window.
        </Typography>
      </Box>
      <Box sx={{ backgroundColor: '#F5F7FB', px: 6, pb: 6, pt: 4 }}>
        {isSecureTransfare && isTransferConfirmed && (
          <Stack flexDirection="row" alignItems="center">
            <CheckCircleIcon sx={styles.circleIcon} />
            <Typography component="div">
              Your organization’s keys were securely transferred to Company
            </Typography>
          </Stack>
        )}
        {isSecureTransfare && !isTransferConfirmed && (
          <Stack flexDirection="row" alignItems="top">
            <InfoIcon sx={styles.infoIcon} />
            <Stack flexDirection="column">
              <Typography>
                Your keys may have been sent to your selected credential agent operator, check with
                them to see if they have securely received the keys.
              </Typography>
              <Typography sx={styles.warningText}>
                Make sure you download your keys immediately.
              </Typography>
            </Stack>
          </Stack>
        )}
        <Form>
          {formattedSecrets.map(({ id, key }) => (
            <Grid key={id} container spacing={2} columns={14} sx={styles.keysBlock}>
              <Grid item xs={5} sx={styles.keyLabel}>
                <Typography>{id}</Typography>
              </Grid>
              <Grid item xs={9}>
                <Typography sx={styles.keyValue}>{key}</Typography>
              </Grid>
            </Grid>
          ))}
          <Box marginTop="30px" sx={styles.doNotDisclosureBlock}>
            <ErrorOutlineIcon />
            <Typography marginLeft="20px">
              Do not disclose these keys to unauthorised persons or transmit via unsecured channels.
            </Typography>
          </Box>

          <Box sx={styles.buttonBlock}>
            <Button
              variant="outlined"
              color="secondary"
              sx={[styles.button, { marginRight: '30px' }]}
              onClick={onCopy}
            >
              {isCopied ? 'Copied' : 'Copy'}
            </Button>

            <Button
              variant="outlined"
              endIcon={<DownloadIcon />}
              sx={styles.button}
              onClick={() => {
                downloadTxtAsFile(
                  'keys.json',
                  objectToString(secretKeys),
                  (isLoading) => setIsLoadingKeys(isLoading),
                  (isError) => setIsLoadingKeysError(isError),
                  (isClicked) => setIsDownloaded(isClicked),
                );
              }}
            >
              Download
            </Button>
          </Box>
        </Form>
      </Box>
    </Popup>
  );
};

const styles = {
  button: { px: 4, py: 1, fontSize: '16px', width: '160px' },
  buttonBlock: {
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: '40px',
  },
  congratulationsText: {
    marginBottom: '20px',
    lineHeight: '130%',
  },
  keysBlock: {
    marginTop: '7px',
  },
  keyLabel: {
    display: 'flex',
    alignItems: 'center',
    wordBreak: 'break-all',
  },
  keyValue: {
    width: '100%',
    borderColor: 'divider.main',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderRadius: '6px',
    padding: '16px',
    boxSizing: 'border-box',
    wordBreak: 'break-word',
  },
  doNotDisclosureBlock: {
    color: 'secondary.light',
    fontSize: '14px',
    display: 'flex',
    flexDirection: 'row',
  },
  circleIcon: { color: 'primary.success', fontSize: '1.75rem', mr: 3 },
  infoIcon: { color: 'primary.warning', fontSize: '1.5rem', mr: 3 },
  warningText: { fontWeight: 'bold', mt: 2 },
};

// eslint-disable-next-line better-mutation/no-mutation
SecretKeysPopup.propTypes = {
  isModalOpened: PropTypes.bool,
  // eslint-disable-next-line react/forbid-prop-types
  secretKeys: PropTypes.object,
  onClose: PropTypes.func,
  onShowWarning: PropTypes.func,
  isSecureTransfare: PropTypes.bool,
  isTransferConfirmed: PropTypes.bool,
};

export default SecretKeysPopup;
