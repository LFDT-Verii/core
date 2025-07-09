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

import { Box, Button, Stack, Tooltip, Typography } from '@mui/material';
import { AutocompleteInput, Form, TextInput, FormDataConsumer, useDataProvider } from 'react-admin';
import { useRef, useCallback } from 'react';
import PropTypes from 'prop-types';
import KeyboardArrowRightIcon from '@mui/icons-material/KeyboardArrowRight';
import InfoIcon from '@mui/icons-material/Info';

import { WEBSITE_HINT, SUPPORT_EMAIL_HINT, TECHNICAL_EMAIL_HINT } from '../../utils/index.jsx';
import {
  validateEmail,
  validateWebsite,
  validateName,
  validateWebsiteStrict,
} from './CreateOrganization.utils';
import OrganizationSubmitButton from './OrganisationSubmitButton.jsx';
import CustomImageInput from '../common/CustomImageInput/index.jsx';
import AuthorityRegistrationNumbersInput from '../../pages/organizations/components/AuthorityRegistrationInput.jsx';
import { LinkedInRegistrationInput } from '../../pages/organizations/components/LinkedInRegistrationInput.jsx';
import { dataResources } from '../../utils/remoteDataProvider';

const CreateInvitationForOrganization = ({ onSubmit, countryCodes, onCancel, defaultValues }) => {
  const dataProvider = useDataProvider();

  const timeout = useRef(null);

  const debouncedValidation = async (value) => {
    clearTimeout(timeout.current);

    if (!value) {
      return undefined;
    }

    return new Promise((resolve) => {
      // eslint-disable-next-line better-mutation/no-mutation
      timeout.current = setTimeout(async () => {
        const inputNormalized = value.replace(/\s\s+/g, ' ').trim().toLowerCase();
        const { data: searchedProfiles } = await dataProvider.getList(
          dataResources.SEARCH_PROFILES,
          {
            search: inputNormalized,
          },
        );
        if (searchedProfiles?.some((org) => org.name.toLowerCase() === inputNormalized)) {
          resolve({ message: 'Organization already exists' });
        } else {
          resolve(undefined);
        }
      }, 500);
    });
  };

  const orgNamevalidation = [...validateName, debouncedValidation];

  const handleSubmit = useCallback(
    (data) => {
      onSubmit(data);
    },
    [onSubmit],
  );

  return (
    <Box>
      <Typography variant="h1" mb={2}>
        Invite Organization
      </Typography>
      <Typography mb={3}>
        To invite an organization to join Velocity Network™, fill in that organization&apos;s
        information below.
      </Typography>

      <Form onSubmit={handleSubmit} noValidate mode="onChange" defaultValues={defaultValues}>
        <FormDataConsumer>
          {({ formData }) => (
            <>
              <TextInput
                fullWidth
                label="Legal Name"
                source="name"
                validate={orgNamevalidation}
                pb={1}
              />
              {/* Uncomment when the flow is ready */}
              {/* <AutoCompleteOrganizationName defaultValue={defaultValues?.org} /> */}
              <Stack flexDirection="row" gap={1.75} mb={3.5} mt={1}>
                <CustomImageInput
                  label={false}
                  labelText=""
                  editMode
                  orientation="vertical"
                  style={{ flexDirection: 'row', minHeight: '200px' }}
                  addTo=""
                  isRequired={false}
                />
              </Stack>
              <TextInput fullWidth multiline label="Short Description" source="description" />
              <Stack flexDirection="row" gap={1.75}>
                <TextInput fullWidth label="Website" source="website" validate={validateWebsite} />
                <Box mt={2}>
                  <Tooltip title={WEBSITE_HINT}>
                    <InfoIcon color="info" fontSize="small" cursor="pointer" />
                  </Tooltip>
                </Box>
              </Stack>
              <TextInput fullWidth label="Address" source="physicalAddress.line1" />
              <AutocompleteInput
                label="Country"
                source="location.countryCode"
                choices={countryCodes}
              />
              <TextInput
                fullWidth
                label="LinkedIn Page"
                source="linkedInProfile"
                validate={validateWebsiteStrict}
              />
              <LinkedInRegistrationInput formData={formData} source="registrationNumbers" />
              <Stack flexDirection="row" gap={1.75}>
                <TextInput
                  fullWidth
                  label="Support Email"
                  source="contactEmail"
                  validate={validateEmail}
                />
                <Box mt={2}>
                  <Tooltip title={SUPPORT_EMAIL_HINT}>
                    <InfoIcon color="info" fontSize="small" cursor="pointer" />
                  </Tooltip>
                </Box>
              </Stack>
              <Stack flexDirection="row" gap={1.75}>
                <TextInput
                  fullWidth
                  label="Technical Contact Email"
                  source="technicalEmail"
                  validate={validateEmail}
                />
                <Box mt={2}>
                  <Tooltip title={TECHNICAL_EMAIL_HINT}>
                    <InfoIcon color="info" fontSize="small" cursor="pointer" />
                  </Tooltip>
                </Box>
              </Stack>
              <AuthorityRegistrationNumbersInput orientation="vertical" isRequired={false} />
              <Box display="flex" justifyContent="center" pt={4}>
                <Button
                  variant="outlined"
                  color="secondary"
                  sx={[sxStyles.button, sxStyles.cancelButton]}
                  onClick={onCancel}
                >
                  Cancel
                </Button>
                <OrganizationSubmitButton
                  styles={sxStyles.button}
                  title="Next"
                  endIcon={<KeyboardArrowRightIcon />}
                />
              </Box>
            </>
          )}
        </FormDataConsumer>
      </Form>
    </Box>
  );
};

// eslint-disable-next-line better-mutation/no-mutation
CreateInvitationForOrganization.propTypes = {
  onSubmit: PropTypes.func.isRequired,
  onCancel: PropTypes.func.isRequired,
  // eslint-disable-next-line react/forbid-prop-types
  countryCodes: PropTypes.array.isRequired,
  // eslint-disable-next-line react/forbid-prop-types
  defaultValues: PropTypes.object,
};

export default CreateInvitationForOrganization;

const sxStyles = {
  section: {
    display: 'block',
    pt: 1,
    pb: '12px',
    fontWeight: 500,
  },
  button: { px: 4, py: 1, fontSize: '16px', width: '160px' },
  cancelButton: { marginRight: '20px' },
  fullWidth: { width: '100%' },
  errorMessage: {
    fontSize: '0.75rem',
    color: 'primary.main',
    marginLeft: '1.25em',
    height: '1.75em',
  },
};
