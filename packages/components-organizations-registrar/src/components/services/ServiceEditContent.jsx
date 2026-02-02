import { TextInput, SaveButton, required } from 'react-admin';

import PropTypes from 'prop-types';
import { Stack } from '@mui/material';
import { useIsIssuingInspection } from '@/pages/services/hooks/useIsIssuingInspection.js';
import WebWalletSelection from '@/pages/services/components/ServiceEndpointSelection/components/WebWalletSelection.jsx';
import HolderWalletSelection from '@/pages/services/components/ServiceEndpointSelection/components/HolderWalletSelection.jsx';
import { validateServiceEndpoint } from '../organizations/CreateOrganizationUtils.js';

export const FormContent = ({ isModifyingServiceEnabled, selectedService }) => {
  const { isIssuingOrInspection, isWebWallet, isHolderWallet } = useIsIssuingInspection({
    id: selectedService?.type,
  });
  const validateArray = [required('Service endpoint URL field is required')];
  if (!isIssuingOrInspection) {
    validateArray.push(...validateServiceEndpoint);
  }

  if (isWebWallet) {
    return (
      <Stack>
        <WebWalletSelection inProgress={false} />
        <SaveButton
          variant="outlined"
          icon={null}
          label="Save"
          sx={sx.saveButton}
          alwaysEnable={isModifyingServiceEnabled}
        />
      </Stack>
    );
  }
  if (isHolderWallet) {
    return (
      <Stack>
        <HolderWalletSelection inProgress={false} />
        <SaveButton
          variant="outlined"
          icon={null}
          label="Save"
          sx={sx.saveButton}
          alwaysEnable={isModifyingServiceEnabled}
        />
      </Stack>
    );
  }
  return (
    <Stack>
      <TextInput
        source="serviceEndpoint"
        label="Service endpoint URL"
        validate={validateArray}
        parse={(value) => value.trim()}
      />
      <SaveButton
        variant="outlined"
        icon={null}
        label="Save"
        sx={sx.saveButton}
        alwaysEnable={isModifyingServiceEnabled}
      />
    </Stack>
  );
};

const sx = {
  saveButton: { width: 'fit-content', alignSelf: 'center', px: 4, py: 1, mt: 2 },
};

// eslint-disable-next-line better-mutation/no-mutation
FormContent.propTypes = {
  isModifyingServiceEnabled: PropTypes.bool.isRequired,
  selectedService: PropTypes.shape({ id: PropTypes.string, type: PropTypes.string }).isRequired,
};
