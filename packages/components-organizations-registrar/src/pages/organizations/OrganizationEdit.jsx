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

import {
  AutocompleteInput,
  email,
  Form,
  Edit,
  required,
  useEditController,
  SaveButton,
  FormDataConsumer,
  ArrayInput,
  SimpleFormIterator,
  TextInput,
} from 'react-admin';
import { useParams } from 'react-router';
import { Box, Grid, Stack, Tooltip, Typography } from '@mui/material';
import InfoIcon from '@mui/icons-material/Info';
import { useState } from 'react';
import {
  validateWebsite,
  validateWebsiteStrict,
} from '../../components/organizations/CreateOrganization.utils';
import Loading from '../../components/Loading.jsx';
import {
  ERRORS,
  formatWebSiteUrl,
  formatRegistrationNumbers,
  SUPPORT_EMAIL_HINT,
  TECHNICAL_EMAIL_HINT,
  WEBSITE_HINT_SHORT,
} from '../../utils/index.jsx';
import useCountryCodes from '../../utils/countryCodes';
import CustomImageInput from '../../components/common/CustomImageInput/index.jsx';
import { defaultBrandValue, allBrandsFilled, isAddBrandDisabled } from './OrganizationCreate.jsx';
import PlusButtonBlock from '../../components/common/PlusButtonBlock.jsx';
import { OrganizationBrand } from './components/OrganizationBrand.jsx';
import AuthorityRegistrationNumbersInput from './components/AuthorityRegistrationInput.jsx';
import { LinkedInRegistrationInput } from './components/LinkedInRegistrationInput.jsx';

const validateEmail = [required(), email()];

const transform = (data) => ({
  ...data,
  profile: {
    ...data.profile,
    website: formatWebSiteUrl(data.profile.website),
    linkedInProfile: formatWebSiteUrl(data.profile.linkedInProfile),
    registrationNumbers: formatRegistrationNumbers(data.profile?.registrationNumbers),
    commercialEntities: data.profile.commercialEntities
      .filter((brand) => brand.logo)
      .map((brand) => ({
        ...brand,
        type: 'Brand',
      })),
  },
});

const modifyRecord = (record) => ({
  ...record,
  profile: {
    ...record.profile,
    commercialEntities: record.profile?.commercialEntities?.length
      ? record.profile.commercialEntities
      : defaultBrandValue,
  },
});

const OrganizationEdit = () => {
  const { id } = useParams();
  const { data: countryCodes, isLoading: isCodesLoading } = useCountryCodes();
  const [errorMessage, setErrorMessage] = useState('');
  const { record, isLoading } = useEditController({
    resource: 'organizations',
    id,
  });

  const onError = ({ body }) => {
    if (body.errorCode === 'webhook_not_protocol_compliant') {
      setErrorMessage(ERRORS.secureWebHook);
    } else {
      setErrorMessage(ERRORS.default);
    }
  };

  if (isLoading || isCodesLoading) return <Loading sx={{ pt: '60px' }} />;

  return (
    <Stack pt={5} pb={10} pr={8} pl={9}>
      <Typography variant="h3" mb={4}>
        Edit profile
      </Typography>
      <Edit
        mutationMode="pessimistic"
        mutationOptions={{ onError }}
        actions={false}
        sx={sx.formContainer}
        transform={(data) => transform(data)}
      >
        <Form record={modifyRecord(record)} mode="onTouched">
          <FormDataConsumer>
            {/* eslint-disable-next-line complexity */}
            {({ formData }) => (
              <>
                <Grid container spacing={5} rowSpacing={1.25}>
                  <Grid size={{ xs: 6 }}>
                    <Stack container flex={1} flexDirection="column">
                      <Grid size={{ xs: 12 }}>
                        <TextInput
                          fullWidth
                          source="profile.name"
                          label="Legal Name"
                          validate={required()}
                          readOnly
                        />
                      </Grid>
                      <Grid size={{ xs: 12 }}>
                        <Stack flexDirection="row" gap={1.75}>
                          <TextInput
                            fullWidth
                            label="Website"
                            source="profile.website"
                            validate={[...validateWebsiteStrict, required()]}
                            disabled
                          />
                          <Box mt={2}>
                            <Tooltip title={WEBSITE_HINT_SHORT}>
                              <InfoIcon color="info" fontSize="small" cursor="pointer" />
                            </Tooltip>
                          </Box>
                        </Stack>
                      </Grid>
                      <Grid size={{ xs: 12 }}>
                        <TextInput
                          fullWidth
                          label="Address"
                          source="profile.physicalAddress.line1"
                          validate={required()}
                        />
                      </Grid>
                      <Grid size={{ xs: 12 }}>
                        <AutocompleteInput
                          fullWidth
                          label="Country"
                          source="profile.location.countryCode"
                          validate={required()}
                          choices={countryCodes}
                        />
                      </Grid>
                    </Stack>
                  </Grid>
                  <Grid size={{ xs: 6 }} p={1}>
                    <CustomImageInput
                      label={false}
                      source="profile.url"
                      editMode={false}
                      imgSrc={formData.profile?.logo}
                      addTo="profile"
                    />
                  </Grid>
                  <Grid size={{ xs: 6 }}>
                    <Stack flexDirection="row" gap={1.75}>
                      <TextInput
                        fullWidth
                        label="LinkedIn Page"
                        source="profile.linkedInProfile"
                        validate={[...validateWebsite, required()]}
                      />
                    </Stack>
                  </Grid>
                  <Grid size={{ xs: 6 }}>
                    <LinkedInRegistrationInput
                      formData={{ ...record, ...formData.profile }}
                      source="profile.registrationNumbers"
                    />
                  </Grid>
                  <Grid size={{ xs: 6 }}>
                    <Stack flexDirection="row" gap={1.75}>
                      <TextInput
                        fullWidth
                        label="Support Email"
                        source="profile.contactEmail"
                        validate={validateEmail}
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
                        source="profile.technicalEmail"
                        validate={validateEmail}
                      />
                      <Box mt={2}>
                        <Tooltip title={TECHNICAL_EMAIL_HINT}>
                          <InfoIcon color="info" fontSize="small" cursor="pointer" />
                        </Tooltip>
                      </Box>
                    </Stack>
                  </Grid>
                  <AuthorityRegistrationNumbersInput
                    source="profile.registrationNumbers"
                    orientation="horizontal"
                  />
                  <Grid size={{ xs: 12 }}>
                    <TextInput fullWidth disabled label="DID" source="id" />
                  </Grid>
                  {formData.didDoc?.alsoKnownAs && (
                    <Grid size={{ xs: 12 }}>
                      <TextInput
                        fullWidth
                        multiline
                        disabled
                        sx={sx.textArea}
                        label="Also Known As"
                        source="didDoc.alsoKnownAs"
                        format={(value) => (Array.isArray(value) ? value.join('\n') : value)}
                      />
                    </Grid>
                  )}
                  <Grid size={{ xs: 12 }}>
                    <TextInput
                      fullWidth
                      multiline
                      label="Short Description"
                      source="profile.description"
                      validate={required()}
                      sx={sx.description}
                    />
                  </Grid>
                  <Grid size={{ xs: 12 }}>
                    <Typography variant="h4" mb={2} mt={4}>
                      Commercial Names
                    </Typography>
                  </Grid>
                  <Grid size={{ xs: 12 }}>
                    <ArrayInput
                      source="profile.commercialEntities"
                      defaultValue={defaultBrandValue}
                      sx={{ '& .RaArrayInput-label': { display: 'none' } }}
                    >
                      <SimpleFormIterator
                        addButton={
                          <PlusButtonBlock
                            style={sx.plusButtonBlock}
                            disabled={
                              !allBrandsFilled([
                                ...(record.profile.commercialEntities || []),
                                ...(formData.profile.commercialEntities || []),
                              ])
                            }
                            position={formData.profile?.commercialEntities?.length}
                          />
                        }
                        disableAdd={isAddBrandDisabled([
                          ...(record.profile.commercialEntities || []),
                          ...(formData.profile.commercialEntities || []),
                        ])}
                        fullWidth
                        sx={sx.brandList}
                      >
                        <FormDataConsumer>
                          {({ scopedFormData }) => {
                            return (
                              <OrganizationBrand
                                formData={formData}
                                scopedFormData={scopedFormData}
                              />
                            );
                          }}
                        </FormDataConsumer>
                      </SimpleFormIterator>
                    </ArrayInput>
                  </Grid>
                </Grid>
                <SaveButton
                  icon={null}
                  variant="outlined"
                  color="primary"
                  type="submit"
                  sx={{ mt: 3 }}
                  label="Update profile"
                />
                <Grid size={{ xs: 12 }}>
                  <Stack flexDirection="row" mt={2}>
                    <Typography variant="subtitle2" sx={{ color: 'primary.main' }}>
                      {errorMessage}
                    </Typography>
                  </Stack>
                </Grid>
              </>
            )}
          </FormDataConsumer>
        </Form>
      </Edit>
    </Stack>
  );
};

export default OrganizationEdit;

const sx = {
  formContainer: {
    '& .RaEdit-card': { boxShadow: 'none', paddingTop: '0.5em' },
    '& .RaEdit-noActions': { marginTop: 0 },
  },
  brandList: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '2rem',
    px: '0.5em',
    justifyContent: 'space-between',
    '& .RaSimpleFormIterator-action': { display: 'none' },
    '& .RaSimpleFormIterator-buttons': { width: '48%' },
    '& .RaSimpleFormIterator-add': { width: '100%' },
    '& .RaSimpleFormIterator-clear': { display: 'none' },
    '& .RaSimpleFormIterator-list': {
      display: 'flex',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
      gap: '2rem',
      flexGrow: '2',
      width: '100%',
      '&:has(li:only-child)': { width: '48%' },
    },
    '& .RaSimpleFormIterator-line': {
      width: '48%',
      '&:only-child': { width: '100%' },
    },
    '& .RaSimpleFormIterator-form': {
      width: '100%',
    },
    '& .MuiBox-root fieldset': {
      height: 'calc(24.5rem - 75px) !important',
    },
  },
  brandLogoContainer: { width: '100%' },
  brandLogo: { minHeight: '272px' },
  plusButtonBlock: { height: '25rem' },
  errorMessage: {
    fontSize: '0.75rem',
    color: 'primary.main',
    marginLeft: '1.25em',
    height: '1.75em',
  },
  fullWidth: {
    width: '100%',
  },
  textArea: { '& textarea': { padding: '0' } },
  description: { '& textarea': { paddingLeft: '0', paddingRight: '0' } },
};
