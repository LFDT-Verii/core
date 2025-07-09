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

import { Box, Stack, Tooltip, Typography, Button } from '@mui/material';
import Grid from '@mui/material/Grid2';
import {
  AutocompleteInput,
  Form,
  maxLength,
  required,
  TextInput,
  FormDataConsumer,
} from 'react-admin';
import { useCallback } from 'react';
import InfoIcon from '@mui/icons-material/Info';
import PropTypes from 'prop-types';
import { useNavigate } from 'react-router';
import { FOOTER_HEIGHT } from '../../theme/theme';
import {
  validateEmail,
  validateName,
  validateWebsite,
  validateWebsiteStrict,
} from './CreateOrganization.utils';
import OrganizationSubmitButton from './OrganisationSubmitButton.jsx';
import CustomImageInput from '../common/CustomImageInput/index.jsx';
import {
  ADMINISTRATOR_DETAILS_HINT,
  SIGNATORY_DETAILS_HINT,
  SUPPORT_EMAIL_HINT,
  TECHNICAL_EMAIL_HINT,
  WEBSITE_HINT,
  SIGNATORY_EMAIL_HINT,
} from '../../utils/index.jsx';
import AuthorityRegistrationNumbersInput from '../../pages/organizations/components/AuthorityRegistrationInput.jsx';
import { LinkedInRegistrationInput } from '../../pages/organizations/components/LinkedInRegistrationInput.jsx';
import { useAuth } from '../../utils/auth/AuthContext';

const CreateOrganization = ({
  children,
  title,
  subTitle,
  buttonTitle,
  onSubmit,
  defaultValues,
  countryCodes,
  isLoading,
  hasOrganisations,
  userData,
}) => {
  const { logout } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = useCallback(
    (data) => {
      onSubmit(data);
    },
    [onSubmit],
  );

  return (
    <Box sx={sxStyles.root}>
      <Stack sx={sxStyles.content}>
        <Typography variant="h1" mb={2}>
          {title}
        </Typography>
        <Typography variant="pl" mb={6.5} textAlign="center">
          {subTitle}
        </Typography>
        <Form defaultValues={defaultValues} onSubmit={handleSubmit} noValidate mode="all">
          <FormDataConsumer>
            {({ formData }) => (
              <>
                <Grid container spacing={4} rowSpacing={1}>
                  <Grid size={{ xs: 6 }}>
                    <Stack container flex={1} flexDirection="column">
                      <Grid size={{ xs: 12 }}>
                        <TextInput
                          fullWidth
                          label="Legal Name"
                          source="name"
                          validate={validateName}
                        />
                      </Grid>
                      <Grid size={{ xs: 12 }}>
                        <Stack flexDirection="row" gap={1.75}>
                          <TextInput
                            fullWidth
                            label="Website"
                            source="website"
                            validate={[required(), ...validateWebsiteStrict]}
                          />
                          <Box mt={2}>
                            <Tooltip title={WEBSITE_HINT}>
                              <InfoIcon color="info" fontSize="small" cursor="pointer" />
                            </Tooltip>
                          </Box>
                        </Stack>
                      </Grid>
                      <Grid size={{ xs: 12 }}>
                        <TextInput
                          fullWidth
                          label="Address"
                          source="physicalAddress.line1"
                          validate={[required(), maxLength(1024)]}
                        />
                      </Grid>
                      <Grid size={{ xs: 12 }}>
                        <AutocompleteInput
                          label="Country"
                          source="location.countryCode"
                          choices={countryCodes}
                          validate={required()}
                        />
                      </Grid>
                    </Stack>
                  </Grid>

                  <Grid size={{ xs: 6 }} pb={1}>
                    <CustomImageInput
                      label={false}
                      editMode={!defaultValues.logo}
                      source="logo"
                      imgSrc={defaultValues?.logo}
                    />
                  </Grid>
                  <Grid size={{ xs: 6 }}>
                    <Stack flexDirection="row" gap={1.75}>
                      <TextInput
                        fullWidth
                        label="LinkedIn Page"
                        source="linkedInProfile"
                        validate={[...validateWebsite, required()]}
                      />
                    </Stack>
                  </Grid>
                  <Grid size={{ xs: 6 }}>
                    <LinkedInRegistrationInput formData={{ ...formData, ...defaultValues }} />
                  </Grid>

                  <Grid size={{ xs: 6 }}>
                    <Stack flexDirection="row" gap={1.75}>
                      <TextInput
                        fullWidth
                        label="Support Email"
                        source="contactEmail"
                        validate={[required(), ...validateEmail]}
                      />
                      <Box mt={2}>
                        <Tooltip title={SUPPORT_EMAIL_HINT}>
                          <InfoIcon color="info" fontSize="small" cursor="pointer" />
                        </Tooltip>
                      </Box>
                    </Stack>
                  </Grid>
                  <Grid size={{ xs: 6 }}>
                    <Stack flexDirection="row" gap={1.75}>
                      <TextInput
                        fullWidth
                        label="Technical Contact Email"
                        source="technicalEmail"
                        validate={[required(), ...validateEmail]}
                      />
                      <Box mt={2}>
                        <Tooltip title={TECHNICAL_EMAIL_HINT}>
                          <InfoIcon color="info" fontSize="small" cursor="pointer" />
                        </Tooltip>
                      </Box>
                    </Stack>
                  </Grid>
                  <AuthorityRegistrationNumbersInput
                    source="registrationNumbers"
                    orientation="horizontal"
                  />
                  <Grid size={{ xs: 12 }}>
                    <TextInput
                      fullWidth
                      multiline
                      label="Short Description"
                      placeholder="Description (a boilerplate for other Network participants to read about the organization)"
                      source="description"
                      validate={required()}
                    />
                  </Grid>
                  <Grid size={{ xs: 6 }}>
                    <Stack flexDirection="row" gap={1.75}>
                      <Typography variant="h4" my={2}>
                        Administrator’s Details
                      </Typography>
                      <Box mt={2.25}>
                        <Tooltip title={ADMINISTRATOR_DETAILS_HINT}>
                          <InfoIcon color="info" fontSize="small" cursor="pointer" />
                        </Tooltip>
                      </Box>
                    </Stack>
                  </Grid>
                  <Grid size={{ xs: 6 }}>
                    <Stack flexDirection="row" gap={1.75}>
                      <Typography variant="h4" my={2}>
                        Signatory Authority’s Details
                      </Typography>
                      <Box mt={2.25}>
                        <Tooltip title={SIGNATORY_DETAILS_HINT}>
                          <InfoIcon color="info" fontSize="small" cursor="pointer" />
                        </Tooltip>
                      </Box>
                    </Stack>
                  </Grid>
                  <Grid size={{ xs: 6 }}>
                    <Stack flexDirection="row" gap={1.75}>
                      <TextInput
                        fullWidth
                        label="First name"
                        source="adminGivenName"
                        validate={[maxLength(1024), required()]}
                        defaultValue={userData ? userData.givenName : ''}
                      />
                    </Stack>
                    <Stack flexDirection="row" gap={1.75}>
                      <TextInput
                        fullWidth
                        label="Last name"
                        source="adminFamilyName"
                        validate={[maxLength(1024), required()]}
                        defaultValue={userData ? userData.familyName : ''}
                      />
                    </Stack>
                  </Grid>
                  <Grid size={{ xs: 6 }}>
                    <Stack flexDirection="row" gap={1.75}>
                      <TextInput
                        fullWidth
                        label="First name"
                        source="signatoryGivenName"
                        validate={[maxLength(1024), required()]}
                      />
                    </Stack>
                    <Stack flexDirection="row" gap={1.75}>
                      <TextInput
                        fullWidth
                        label="Last name"
                        source="signatoryFamilyName"
                        validate={[maxLength(1024), required()]}
                      />
                    </Stack>
                  </Grid>
                  <Grid size={{ xs: 6 }}>
                    <Stack flexDirection="row" gap={1.75}>
                      <TextInput
                        fullWidth
                        label="Job Title"
                        source="adminTitle"
                        validate={[maxLength(1024), required()]}
                      />
                    </Stack>
                  </Grid>
                  <Grid size={{ xs: 6 }}>
                    <Stack flexDirection="row" gap={1.75}>
                      <TextInput
                        fullWidth
                        label="Job Title"
                        source="signatoryTitle"
                        validate={[maxLength(1024), required()]}
                      />
                    </Stack>
                  </Grid>
                  <Grid size={{ xs: 6 }}>
                    <Stack flexDirection="row" gap={1.75}>
                      <TextInput
                        fullWidth
                        label="Email"
                        source="adminEmail"
                        validate={[...validateEmail, required()]}
                        defaultValue={userData ? userData.email : ''}
                      />
                    </Stack>
                  </Grid>
                  <Grid size={{ xs: 6 }}>
                    <Stack flexDirection="row" gap={1.75}>
                      <TextInput
                        fullWidth
                        label="Email"
                        source="signatoryEmail"
                        validate={[...validateEmail, required()]}
                      />
                      <Box mt={2}>
                        <Tooltip title={SIGNATORY_EMAIL_HINT}>
                          <InfoIcon color="info" fontSize="small" cursor="pointer" />
                        </Tooltip>
                      </Box>
                    </Stack>
                  </Grid>
                </Grid>
                {children}
                <Box display="flex" justifyContent="center" pt={4}>
                  <Button
                    variant="outlined"
                    color="secondary"
                    size="large"
                    sx={sxStyles.cancelButton}
                    onClick={() => (hasOrganisations ? navigate('/') : logout())}
                  >
                    Cancel
                  </Button>
                  <OrganizationSubmitButton
                    title={buttonTitle}
                    isLoading={isLoading}
                    styles={sxStyles.saveButton}
                    enabled
                  />
                </Box>
              </>
            )}
          </FormDataConsumer>
        </Form>
      </Stack>
    </Box>
  );
};

// eslint-disable-next-line better-mutation/no-mutation
CreateOrganization.propTypes = {
  title: PropTypes.string.isRequired,
  subTitle: PropTypes.string.isRequired,
  buttonTitle: PropTypes.string.isRequired,
  children: PropTypes.node,
  onSubmit: PropTypes.func.isRequired,
  // eslint-disable-next-line react/forbid-prop-types
  defaultValues: PropTypes.object,
  // eslint-disable-next-line react/forbid-prop-types
  countryCodes: PropTypes.array,
  isLoading: PropTypes.bool.isRequired,
  hasOrganisations: PropTypes.bool,
  // eslint-disable-next-line react/forbid-prop-types
  userData: PropTypes.object,
};

export default CreateOrganization;

const sxStyles = {
  root: {
    pt: 7.5,
    pl: 1,
    pb: `calc(35px + ${FOOTER_HEIGHT})`,
    boxSizing: 'border-box',
    display: 'flex',
    justifyContent: 'center',
  },
  content: {
    maxWidth: 886,
    alignItems: 'center',
  },
  saveButton: {
    minWidth: 160,
  },
  cancelButton: {
    minWidth: 160,
    mr: 2,
  },
  errorMessage: {
    fontSize: '0.75rem',
    color: 'primary.main',
    marginLeft: '1.25em',
    height: '1.75em',
  },
  fullWidth: {
    width: '100%',
  },
};
