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

import { useState } from 'react';
import { Box, InputAdornment } from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { Form, TextInput, required } from 'react-admin';
import PropTypes from 'prop-types';

import { validateEmail } from '../organizations/CreateOrganization.utils';
import OrganizationSubmitButton from '../organizations/OrganisationSubmitButton.jsx';

const SetInvitationEmail = ({ children, onSubmit, defaultValue, loading }) => {
  const [isEmailValid, setIsEmailValid] = useState(false);

  return (
    <Form mode="onChange" onSubmit={onSubmit}>
      <TextInput
        fullWidth
        label="Email"
        type="email"
        source="inviteeEmail"
        defaultValue={defaultValue}
        validate={[required(), ...validateEmail]}
        InputProps={{
          endAdornment: isEmailValid ? (
            <InputAdornment position="end">
              <CheckCircleIcon color="success" />
            </InputAdornment>
          ) : null,
        }}
      />

      <Box sx={styles.buttonBlock}>
        {children}
        <OrganizationSubmitButton
          styles={styles.inviteButton}
          title="Invite client"
          handleState={setIsEmailValid}
          isLoading={loading}
        />
      </Box>
    </Form>
  );
};

const styles = {
  buttonBlock: {
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 2,
    flex: 1,
  },
  backButton: {
    px: 4,
    py: 1,
    fontSize: '16px',
    width: '160px',
    marginRight: '20px',
    borderColor: 'secondary.light',
    color: 'text.primary',
  },
  inviteButton: {
    width: '160px',
  },
};

// eslint-disable-next-line better-mutation/no-mutation
SetInvitationEmail.propTypes = {
  children: PropTypes.node.isRequired,
  onSubmit: PropTypes.func.isRequired,
  defaultValue: PropTypes.string,
  loading: PropTypes.bool,
};

export default SetInvitationEmail;
