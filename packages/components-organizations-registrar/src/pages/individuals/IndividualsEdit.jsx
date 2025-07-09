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
import {
  Form,
  Edit,
  required,
  TextInput,
  useEditController,
  SaveButton,
  FormDataConsumer,
  email,
} from 'react-admin';
import { useParams } from 'react-router';
import { Stack, Typography, Box, Tooltip } from '@mui/material';
import Grid from '@mui/material/Grid2';
import InfoIcon from '@mui/icons-material/Info';
import { omit } from 'lodash/fp';
import Loading from '../../components/Loading.jsx';
import {
  ERRORS,
  ADMINISTRATOR_DETAILS_HINT,
  SIGNATORY_DETAILS_HINT,
  SIGNATORY_EMAIL_HINT,
} from '../../utils/index.jsx';

const validateEmail = [required(), email()];

const IndividualsEdit = () => {
  const { id } = useParams();
  const [errorMessage, setErrorMessage] = useState('');
  const { isLoading } = useEditController({
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

  if (isLoading) return <Loading sx={{ pt: '60px' }} />;

  return (
    <Stack pt={5} pb={10} pr={8} pl={9}>
      <Typography variant="h3" mb={4}>
        Key Individuals
      </Typography>
      <Edit
        mutationMode="pessimistic"
        mutationOptions={{ onError }}
        actions={false}
        sx={sx.formContainer}
        resource="organizations"
        redirect={() => `individuals/${id}/show`}
        transform={(data) => ({ ...data, ...{ profile: omit(['website'], data.profile) } })}
      >
        <Form mode="onTouched">
          <FormDataConsumer>
            {() => (
              <>
                <Grid container spacing={5} rowSpacing={1.25}>
                  <Grid size={{ xs: 6 }}>
                    <Stack container flex={1} flexDirection="column">
                      <Stack flexDirection="row" gap={1.75}>
                        <Typography component="div" variant="h4" sx={sx.headingContainer}>
                          Administrator’s Details
                        </Typography>
                        <Box mt={0.25}>
                          <Tooltip title={ADMINISTRATOR_DETAILS_HINT}>
                            <InfoIcon color="info" fontSize="small" cursor="pointer" />
                          </Tooltip>
                        </Box>
                      </Stack>
                      <Grid size={{ xs: 12 }}>
                        <TextInput
                          fullWidth
                          label="First name"
                          source="profile.adminGivenName"
                          validate={required()}
                        />
                      </Grid>
                      <Grid size={{ xs: 12 }}>
                        <TextInput
                          fullWidth
                          label="Last name"
                          source="profile.adminFamilyName"
                          validate={required()}
                        />
                      </Grid>
                      <Grid size={{ xs: 12 }}>
                        <TextInput
                          fullWidth
                          label="Job Title"
                          source="profile.adminTitle"
                          validate={required()}
                        />
                      </Grid>
                      <Grid size={{ xs: 12 }}>
                        <TextInput
                          fullWidth
                          label="Email"
                          source="profile.adminEmail"
                          validate={validateEmail}
                        />
                      </Grid>
                    </Stack>
                  </Grid>
                  <Grid size={{ xs: 6 }} p={1}>
                    <Stack container flex={1} flexDirection="column">
                      <Stack flexDirection="row" gap={1.75}>
                        <Typography component="div" variant="h4" sx={sx.headingContainer}>
                          Signatory Authority’s Details
                        </Typography>
                        <Box mt={0.25}>
                          <Tooltip title={SIGNATORY_DETAILS_HINT}>
                            <InfoIcon color="info" fontSize="small" cursor="pointer" />
                          </Tooltip>
                        </Box>
                      </Stack>
                      <Grid size={{ xs: 12 }}>
                        <TextInput
                          fullWidth
                          label="First name"
                          source="profile.signatoryGivenName"
                          validate={required()}
                        />
                      </Grid>
                      <Grid size={{ xs: 12 }}>
                        <TextInput
                          fullWidth
                          label="Last name"
                          source="profile.signatoryFamilyName"
                          validate={required()}
                        />
                      </Grid>
                      <Grid size={{ xs: 12 }}>
                        <TextInput
                          fullWidth
                          label="Job Title"
                          source="profile.signatoryTitle"
                          validate={required()}
                        />
                      </Grid>
                      <Grid size={{ xs: 12 }}>
                        <Stack flexDirection="row" gap={1.75}>
                          <TextInput
                            fullWidth
                            label="Email"
                            source="profile.signatoryEmail"
                            validate={validateEmail}
                          />
                          <Box mt={2}>
                            <Tooltip title={SIGNATORY_EMAIL_HINT}>
                              <InfoIcon color="info" fontSize="small" cursor="pointer" />
                            </Tooltip>
                          </Box>
                        </Stack>
                      </Grid>
                    </Stack>
                  </Grid>
                </Grid>
                <SaveButton
                  icon={null}
                  variant="outlined"
                  color="primary"
                  type="submit"
                  sx={{ mt: 3, fontWeight: 600 }}
                  label="Update details"
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

export default IndividualsEdit;

const sx = {
  formContainer: {
    '& .RaEdit-card': { boxShadow: 'none', paddingTop: '0.5em' },
    '& .RaEdit-noActions': { marginTop: 0 },
  },
  headingContainer: {
    marginBottom: '30px',
  },
};
