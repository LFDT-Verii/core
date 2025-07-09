import { useMemo } from 'react';
import { Box, Button, Typography } from '@mui/material';
import Grid from '@mui/material/Grid2';
import InfoIcon from '@mui/icons-material/Info';
import DownloadIcon from '@mui/icons-material/Download';
import { Form } from 'react-admin';
import PropTypes from 'prop-types';

import { getTitle, formatSecrets } from '@/pages/services/utils';

const selectedStep = 4;

export const ServiceSecretKeys = ({
  secretKeys,
  subtitle,
  description,
  onDownload,
  onCopy,
  isCopied,
}) => {
  const formattedKeys = useMemo(() => formatSecrets(secretKeys), [secretKeys]);

  return (
    <>
      <Typography sx={styles.title} mb={2}>
        {getTitle(selectedStep)}
      </Typography>
      <Typography sx={styles.subtitle}>{subtitle}</Typography>
      <Typography>{description}</Typography>
      <Form>
        {formattedKeys.map((item) => (
          <Grid container spacing={2} columns={14} key={item.id} sx={styles.keysBlock}>
            <Key label={item.id} />
            <Value value={item.key} />
          </Grid>
        ))}
        <Box sx={styles.doNotDisclosureBlock}>
          <InfoIcon />
          <Typography marginLeft="20px">
            Do not disclose these keys to unauthorized persons or transmit via unsecured channels.
          </Typography>
        </Box>

        <Box sx={styles.buttonsBlock}>
          <Button
            variant="outlined"
            color="secondary"
            sx={[styles.button, { marginRight: '30px' }]}
            onClick={() => onCopy(secretKeys)}
          >
            {isCopied ? 'Copied' : 'Copy'}
          </Button>
          <Button
            variant="outlined"
            endIcon={<DownloadIcon />}
            sx={styles.button}
            onClick={() => onDownload(secretKeys)}
          >
            Download
          </Button>
        </Box>
      </Form>
    </>
  );
};

const Key = ({ label }) => (
  <Grid size={{ xs: 4 }} sx={styles.keyLabel}>
    <Typography>{label}</Typography>
  </Grid>
);

const Value = ({ value }) => (
  <Grid size={{ xs: 10 }}>
    <Typography sx={styles.keyValue}>{value}</Typography>
  </Grid>
);

const styles = {
  title: {
    fontSize: '32px',
    fontWeight: '600',
    lineHeight: '38px',
  },
  subtitle: {
    fontWeight: '600',
    fontSize: '16px',
    marginBottom: '24px',
  },
  doNotDisclosureBlock: {
    color: 'secondary.light',
    fontSize: '14px',
    display: 'flex',
    flexDirection: 'row',
    marginTop: '30px',
  },
  keysBlock: {
    marginTop: '30px',
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
  buttonsBlock: {
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: '40px',
  },
  button: { px: 4, py: 1, fontSize: '16px', width: '160px' },
};

// eslint-disable-next-line better-mutation/no-mutation
ServiceSecretKeys.propTypes = {
  // eslint-disable-next-line react/forbid-prop-types
  secretKeys: PropTypes.object,
  subtitle: PropTypes.string,
  description: PropTypes.string,
  onCopy: PropTypes.func,
  isCopied: PropTypes.bool,
  onDownload: PropTypes.func,
};

// eslint-disable-next-line better-mutation/no-mutation
Key.propTypes = {
  label: PropTypes.string.isRequired,
};
// eslint-disable-next-line better-mutation/no-mutation
Value.propTypes = {
  value: PropTypes.string.isRequired,
};

export default ServiceSecretKeys;
