import { useState, useMemo } from 'react';
import { Box, Stack, Tooltip } from '@mui/material';
import InfoIcon from '@mui/icons-material/Info';
import PropTypes from 'prop-types';

import CustomDropDown from '@/components/common/CustomDropDown.jsx';
import Autocomplete from '@/components/common/Autocomplete.jsx';
import OrganizationAvatar from '@/components/common/OrganizationAvatar.jsx';

const IssuingOrInspectionSelection = ({ credentialAgentOperators, inProgress }) => {
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
    <Stack sx={{ mt: 2 }}>
      <Stack flexDirection="row" alignItems="center" sx={styles.selectCAOContainer}>
        <Autocomplete
          source="serviceCAO"
          label="Select Credential Agent Operator"
          value={selectedCAO}
          onChange={setSelectedCAO}
          items={credentialAgentOperators}
          stringValue={(item) => (
            <Box sx={styles.menuItemLogo} component="div">
              <span>{item.name}</span>
              <OrganizationAvatar size={32} name={item.name} logo={item.logo} />
            </Box>
          )}
          inputText={getOptionAsText}
          disabled={inProgress}
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
          disabled={!selectedCAO || inProgress}
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
  );
};

const styles = {
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
};

// eslint-disable-next-line better-mutation/no-mutation
IssuingOrInspectionSelection.propTypes = {
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
  inProgress: PropTypes.bool.isRequired,
};

export default IssuingOrInspectionSelection;
