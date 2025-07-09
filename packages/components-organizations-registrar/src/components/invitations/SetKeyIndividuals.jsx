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

import { Box, Stack, Typography, Tooltip, Button } from '@mui/material';
import { Form, FormDataConsumer, TextInput, maxLength, required } from 'react-admin';
import PropTypes from 'prop-types';
import InfoIcon from '@mui/icons-material/Info';
import KeyboardArrowLeftIcon from '@mui/icons-material/KeyboardArrowLeft';
import { validateEmail } from '../organizations/CreateOrganization.utils';
import OrganizationSubmitButton from '../organizations/OrganisationSubmitButton.jsx';
import {
  ADMINISTRATOR_DETAILS_HINT,
  SIGNATORY_DETAILS_HINT,
  SIGNATORY_EMAIL_HINT,
} from '../../utils/index.jsx';

const SetKeyIndividuals = ({ children, onSubmit, defaultValues, onBack, loading }) => {
  return (
    <Form mode="onChange" onSubmit={onSubmit} defaultValues={defaultValues}>
      <Stack>
        <Stack direction="row" spacing={1.5} my={2}>
          <Typography variant="h4" sx={styles.subTitle}>
            Administrator’s Details
          </Typography>
          <Box mt={1}>
            <Tooltip title={ADMINISTRATOR_DETAILS_HINT}>
              <InfoIcon color="info" fontSize="small" cursor="pointer" />
            </Tooltip>
          </Box>
        </Stack>
        <Typography variant="body2" sx={styles.infoText}>
          The invitation will be sent to this email.
        </Typography>
        <TextInput
          fullWidth
          label="Email"
          source="adminEmail"
          validate={[...validateEmail, required()]}
        />
        <TextInput
          fullWidth
          label="First name"
          source="adminGivenName"
          validate={[maxLength(1024), required()]}
        />
        <TextInput
          fullWidth
          label="Last name"
          source="adminFamilyName"
          validate={[maxLength(1024), required()]}
        />
        <TextInput fullWidth label="Job Title" source="adminTitle" validate={[maxLength(1024)]} />
        <Stack direction="row" spacing={1.5} my={2}>
          <Typography variant="h4" sx={styles.subTitle}>
            Signatory Authority’s Details
          </Typography>
          <Box mt={1}>
            <Tooltip title={SIGNATORY_DETAILS_HINT}>
              <InfoIcon color="info" fontSize="small" cursor="pointer" />
            </Tooltip>
          </Box>
        </Stack>
        <Stack flexDirection="row" gap={1.75}>
          <TextInput fullWidth label="Email" source="signatoryEmail" validate={validateEmail} />
          <Box mt={2}>
            <Tooltip title={SIGNATORY_EMAIL_HINT}>
              <InfoIcon color="info" fontSize="small" cursor="pointer" />
            </Tooltip>
          </Box>
        </Stack>
        <TextInput
          fullWidth
          label="First name"
          source="signatoryGivenName"
          validate={[maxLength(1024)]}
        />
        <TextInput
          fullWidth
          label="Last name"
          source="signatoryFamilyName"
          validate={[maxLength(1024)]}
        />
        <TextInput
          fullWidth
          label="Job Title"
          source="signatoryTitle"
          validate={[maxLength(1024)]}
        />
      </Stack>

      <Box sx={styles.buttonBlock}>
        <FormDataConsumer>
          {({ formData }) => (
            <Button
              variant="outlined"
              color="secondary"
              sx={styles.button}
              onClick={() => onBack(formData)}
              startIcon={<KeyboardArrowLeftIcon />}
            >
              Back
            </Button>
          )}
        </FormDataConsumer>
        {children}

        <OrganizationSubmitButton
          title="Invite Client"
          styles={styles.button}
          isLoading={loading}
        />
      </Box>
    </Form>
  );
};

const styles = {
  infoText: {
    color: 'primary.main',
    fontWeight: '600',
    marginTop: 1,
    marginBottom: 1.5,
  },
  subTitle: {
    fontSize: '18px',
    fontWeight: '600',
  },
  buttonBlock: {
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 2,
    flex: 1,
    gap: '1em',
  },
  button: { px: 0, py: 1, fontSize: '16px', width: '160px' },
};

// eslint-disable-next-line better-mutation/no-mutation
SetKeyIndividuals.propTypes = {
  children: PropTypes.node.isRequired,
  onSubmit: PropTypes.func.isRequired,
  onBack: PropTypes.func.isRequired,
  // eslint-disable-next-line react/forbid-prop-types
  defaultValues: PropTypes.object,
  loading: PropTypes.bool,
};

export default SetKeyIndividuals;
