import React from 'react';
import PropTypes from 'prop-types';
import { TextInput } from 'react-admin';
import { Box, Stack, Tooltip } from '@mui/material';
import InfoIcon from '@mui/icons-material/Info';

import { preservedRegistrationNumbers } from './AuthorityRegistrationInput.jsx';
import { Authorities } from '../../../constants/messageCodes';

export const LinkedInRegistrationInput = ({ formData, source = 'registrationNumbers' }) => (
  <Stack flexDirection="row" gap={1.75}>
    <TextInput
      fullWidth
      label={preservedRegistrationNumbers.LinkedIn.label}
      source={source}
      parse={(value) => {
        const existing = formData?.registrationNumbers || [];
        const preserved = existing.filter(
          (item) => item.authority !== preservedRegistrationNumbers.LinkedIn.authority,
        );
        return [
          ...preserved,
          {
            authority: Authorities.LinkedIn,
            number: value || '',
          },
        ];
      }}
      format={(value) => {
        const existing = value || [];
        return (
          existing.find(
            (item) => item.authority === preservedRegistrationNumbers.LinkedIn.authority,
          )?.number || ''
        );
      }}
    />
    <Box mt={2}>
      <Tooltip title={preservedRegistrationNumbers.LinkedIn.hint}>
        <InfoIcon color="info" fontSize="small" cursor="pointer" />
      </Tooltip>
    </Box>
  </Stack>
);

// eslint-disable-next-line better-mutation/no-mutation
LinkedInRegistrationInput.propTypes = {
  formData: PropTypes.object,
  source: PropTypes.string,
};

export default LinkedInRegistrationInput;
