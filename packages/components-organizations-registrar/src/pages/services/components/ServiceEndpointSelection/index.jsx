import { Form, FormDataConsumer, SaveButton } from 'react-admin';
import { Box, Button, Stack, Typography } from '@mui/material';
import KeyboardArrowLeftIcon from '@mui/icons-material/KeyboardArrowLeft';

import PropTypes from 'prop-types';
import { useIsIssuingInspection } from '../../hooks/useIsIssuingInspection.js';
import IssuingOrInspectionSelection from './components/IssuingOrInspectionSelection.jsx';
import WebWalletSelection from './components/WebWalletSelection.jsx';
import HolderWalletSelection from './components/HolderWalletSelection.jsx';
import { UserAgreement } from './components/UserAgreement.jsx';
import CAOSelection from './components/CAOSelection.jsx';

import { getTitle, isAddButtonDisabled } from '../../utils/index.js';

const selectedStep = 2;

export const ServiceEndpointSelection = ({
  credentialAgentOperators,
  selectedServiceType,
  inProgress,
  onCreate,
  handleBack,
}) => {
  const { isIssuingOrInspection, isCAO, isWallet, isWebWallet, isHolderWallet } =
    useIsIssuingInspection(selectedServiceType);

  return (
    <>
      <Typography variant="pm" sx={styles.step}>
        Step 2/2
      </Typography>
      <Typography sx={styles.title} mb={2}>
        {getTitle(selectedStep)}
      </Typography>
      <Typography>Please complete the details below to continue</Typography>
      <Form onSubmit={onCreate} mode="onChange" defaultValues={{ serviceEndpoint: '' }}>
        <Stack sx={styles.endpointForm}>
          {isIssuingOrInspection && (
            <IssuingOrInspectionSelection
              credentialAgentOperators={credentialAgentOperators}
              inProgress={inProgress}
            />
          )}

          {isWebWallet && <WebWalletSelection inProgress={inProgress} />}

          {isHolderWallet && <HolderWalletSelection inProgress={inProgress} />}

          {isCAO && <CAOSelection inProgress={inProgress} />}
          <UserAgreement isWallet={isWallet} />
          <Box sx={styles.buttonBlock}>
            <Button
              variant="outlined"
              sx={[styles.button, styles.backButton]}
              onClick={handleBack}
              startIcon={<KeyboardArrowLeftIcon />}
              disabled={inProgress}
            >
              Back
            </Button>
            <FormDataConsumer>
              {({ formData }) => {
                const isDisabled = isAddButtonDisabled(
                  inProgress,
                  isIssuingOrInspection,
                  isCAO,
                  isWebWallet,
                  isHolderWallet,
                  formData,
                );

                return (
                  <SaveButton
                    variant="outlined"
                    alwaysEnable={false}
                    disabled={isDisabled}
                    icon={null}
                    label="Add"
                    sx={[styles.button, styles.saveButton, isDisabled && styles.saveButtonDisabled]}
                  />
                );
              }}
            </FormDataConsumer>
          </Box>
        </Stack>
      </Form>
    </>
  );
};

const styles = {
  step: { color: (theme) => theme.palette.primary.main, pb: '20px', display: 'block' },
  title: {
    fontSize: '32px',
    fontWeight: '600',
    lineHeight: '38px',
  },
  endpointForm: {
    marginTop: '20px',
  },
  buttonBlock: {
    display: 'flex',
    marginTop: '40px',
    justifyContent: 'center',
  },
  button: { px: 4, py: 1, fontSize: '16px', width: '160px' },
  backButton: {
    marginRight: '20px',
    borderColor: 'secondary.light',
    color: 'text.primary',
  },
  saveButton: {
    display: 'flex',
    flexDirection: 'row-reverse',
    gap: '10px',
    '&:disabled': {
      color: 'primary.main',
      borderColor: 'primary.main',
    },
  },
  saveButtonDisabled: {
    '&:disabled': {
      color: 'text.disabled',
      borderColor: 'secondary.light',
    },
  },
};
// eslint-disable-next-line better-mutation/no-mutation
ServiceEndpointSelection.propTypes = {
  credentialAgentOperators: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string.isRequired,
      name: PropTypes.string.isRequired,
      logo: PropTypes.string,
      service: PropTypes.arrayOf(
        PropTypes.shape({
          id: PropTypes.string.isRequired,
          serviceEndpoint: PropTypes.string.isRequired,
        }),
      ),
    }),
  ).isRequired,
  selectedServiceType: PropTypes.string.isRequired,
  inProgress: PropTypes.bool.isRequired,
  onCreate: PropTypes.func.isRequired,
  handleBack: PropTypes.func.isRequired,
};

export default ServiceEndpointSelection;
