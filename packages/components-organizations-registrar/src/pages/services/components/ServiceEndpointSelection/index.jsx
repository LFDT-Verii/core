import { useState, useMemo } from 'react';
import { Box, Button, Stack, Typography, Tooltip, Link } from '@mui/material';
import KeyboardArrowLeftIcon from '@mui/icons-material/KeyboardArrowLeft';
import { Form, FormDataConsumer, SaveButton, TextInput, required } from 'react-admin';
import InfoIcon from '@mui/icons-material/Info';

import PropTypes from 'prop-types';
import CustomDropDown from '@/components/common/CustomDropDown.jsx';
import Autocomplete from '@/components/common/Autocomplete.jsx';
import OrganizationAvatar from '@/components/common/OrganizationAvatar.jsx';
import { validateServiceEndpoint } from '@/components/organizations/CreateOrganization.utils';
import { chainNames } from '@/utils/chainNames';
import { useConfig } from '@/utils/ConfigContext';

import { getTitle, isAddButtonDisabled } from '../../utils';

const selectedStep = 2;

// eslint-disable-next-line prefer-arrow-functions/prefer-arrow-functions
export const ServiceEndpointSelection = ({
  credentialAgentOperators,
  isIssueOrInspection,
  inProgress,
  onCreate,
  handleBack,
}) => {
  const config = useConfig();
  const [selectedCAO, setSelectedCAO] = useState('');
  const [selectedServiceId, setSelectedServiceId] = useState('');
  const getOptionAsText = (item) => item.name;

  const CAO = useMemo(() => {
    if (selectedCAO) {
      return credentialAgentOperators.find((item) => item.id === selectedCAO);
    }
    return '';
  }, [credentialAgentOperators, selectedCAO]);

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
          {isIssueOrInspection ? (
            <Stack sx={{ mt: 2 }}>
              <Stack flexDirection="row" alignItems="center" sx={styles.selectCAOContainer}>
                <Autocomplete
                  source="serviceCAO"
                  label="Select Credential Agent Operator"
                  value={selectedCAO}
                  onChange={setSelectedCAO}
                  items={credentialAgentOperators}
                  /* eslint-disable-next-line react/no-unstable-nested-components */
                  stringValue={(item) => (
                    <Box sx={styles.menuItemLogo} component="div">
                      <span>{item.name}</span>
                      <OrganizationAvatar size={32} name={item.name} logo={item.logo} />
                    </Box>
                  )}
                  inputText={getOptionAsText}
                  disabled={false}
                  styles={styles.selectCAO}
                />
                <Box sx={{ ml: 2 }}>
                  <Tooltip title="The Credential Agent Operator your organization will use to integrate with Velocity Network™">
                    <InfoIcon color="info" fontSize="small" cursor="pointer" />
                  </Tooltip>
                </Box>
              </Stack>
              <Stack flexDirection="row" alignItems="center" mt={1} mb={4}>
                <CustomDropDown
                  label='Select "Service ID"'
                  value={selectedServiceId}
                  onChange={setSelectedServiceId}
                  items={CAO.service || []}
                  stringValue={(item) => `${item.id} (${item.serviceEndpoint})`}
                  disabled={!selectedCAO}
                  source="serviceEndpoint"
                  parse={(value) => `${selectedCAO}${value.id}`}
                />
                <Box sx={{ ml: 2 }}>
                  <Tooltip
                    title="The agent's service ID your organization needs to use. 
                  If there are multiple service IDs available, please contact your Credential Agent Operator to know which one to select."
                  >
                    <InfoIcon color="info" fontSize="small" cursor="pointer" />
                  </Tooltip>
                </Box>
              </Stack>
            </Stack>
          ) : (
            <TextInput
              source="serviceEndpoint"
              label="Service endpoint URL"
              validate={[
                required('Service endpoint URL field is required'),
                ...validateServiceEndpoint,
              ]}
              parse={(value) => value?.trim() ?? ''}
              disabled={inProgress}
            />
          )}
          {config.chainName !== chainNames.testnet && (
            <Typography variant="subtitle1" sx={{ marginTop: '10px' }}>
              <span>By clicking Add, you agree to our </span>
              <Link
                target="_blank"
                href="https://www.velocitynetwork.foundation/main2/participation-agreements"
              >
                Participant Agreement
              </Link>
            </Typography>
          )}
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
                  isIssueOrInspection,
                  formData.serviceCAO,
                  formData.serviceEndpoint,
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
  selectCAOContainer: {
    width: '100%',
    marginBottom: '20px',
  },
  selectCAO: {
    width: '100%',
    '& .MuiInputBase-root': {
      width: '100%',
    },
    '& .MuiSelect-select': {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      py: 0,
    },
    '& .MuiFormHelperText-root': {
      display: 'none',
    },
  },
  menuItemLogo: {
    display: 'flex',
    flex: '1',
    justifyContent: 'space-between',
    alignItems: 'center',
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
  isIssueOrInspection: PropTypes.bool.isRequired,
  inProgress: PropTypes.bool.isRequired,
  onCreate: PropTypes.func.isRequired,
  handleBack: PropTypes.func.isRequired,
};

export default ServiceEndpointSelection;
