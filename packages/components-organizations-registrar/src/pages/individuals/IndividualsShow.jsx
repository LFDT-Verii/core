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

import React from 'react';
import { useParams, useNavigate } from 'react-router';
import { useGetOne, useRedirect } from 'react-admin';
import { Box, Button, Stack, Typography, Paper, Tooltip } from '@mui/material';
import Grid from '@mui/material/Grid2';
import EditIcon from '@mui/icons-material/Edit';
import InfoIcon from '@mui/icons-material/Info';
import useSelectedOrganization from '@/state/selectedOrganizationState';
import Loading from '@/components/Loading.jsx';
import DataItem from '@/components/common/DataItem.jsx';
import { useAuth } from '@/utils/auth/AuthContext';
import {
  ADMINISTRATOR_DETAILS_HINT,
  SIGNATORY_DETAILS_HINT,
  SIGNATORY_EMAIL_HINT,
} from '@/utils/index.jsx';

const IndividualsShow = () => {
  const [savedDid, setDid] = useSelectedOrganization();
  const { id } = useParams();
  const redirect = useRedirect();
  const { data: record, isLoading } = useGetOne(
    'organizations',
    { id },
    {
      onError: () => {
        setDid('');
        redirect('/');
      },
    },
  );

  const navigate = useNavigate();

  React.useEffect(() => {
    if (id !== savedDid) {
      navigate(`/organizations/${savedDid}/show`, { replace: true });
    }
  }, [id, navigate, savedDid]);

  const { getAccessToken } = useAuth();
  const [token, setToken] = React.useState('');

  React.useEffect(() => {
    const getToken = async () => {
      try {
        const accessToken = await getAccessToken();
        setToken(accessToken);
      } catch (e) {
        // eslint-disable-next-line no-console
        console.log(e.message);
      }
    };
    getToken();
  }, [getAccessToken]);

  if (!token || isLoading) {
    return (
      <Box pt={5} pb={10} pr={8} pl={9}>
        <Loading />
      </Box>
    );
  }

  return (
    <Box pt={5} pb={10} pr={8} pl={9}>
      <Stack mb={3.75} direction="row" alignItems="center" justifyContent="space-between">
        <Typography variant="h3">Key Individuals</Typography>
        <Button
          sx={{
            fontSize: '12px',
            fontWeight: '600',
          }}
          variant="contained"
          startIcon={<EditIcon sx={{ width: '16px', height: '16px' }} />}
          onClick={() => redirect('edit', 'individuals', id)}
        >
          Edit Details
        </Button>
      </Stack>
      <Grid container spacing={1}>
        <Grid size={{ xs: 6 }}>
          <Paper
            elevation={2}
            sx={{
              p: 3,
              display: 'flex',
              flexDirection: 'column',
              gap: '30px',
            }}
          >
            <Stack direction="row" spacing={1.5}>
              <Typography component="div" variant="h4">
                Administrator’s Details
              </Typography>
              <Box mt={0.25}>
                <Tooltip title={ADMINISTRATOR_DETAILS_HINT}>
                  <InfoIcon color="info" fontSize="small" cursor="pointer" />
                </Tooltip>
              </Box>
            </Stack>
            <DataItem title="First name" value={record.profile.adminGivenName} sxValue={sx.value} />
            <DataItem title="Last name" value={record.profile.adminFamilyName} sxValue={sx.value} />
            <DataItem title="Job Title" value={record.profile.adminTitle} sxValue={sx.value} />
            <DataItem title="Email" value={record.profile.adminEmail} sxValue={sx.value} />
          </Paper>
        </Grid>
        <Grid size={{ xs: 6 }}>
          <Paper
            elevation={2}
            sx={{
              p: 3,
              display: 'flex',
              flexDirection: 'column',
              gap: '30px',
            }}
          >
            <Stack direction="row" spacing={1.5}>
              <Typography component="div" variant="h4">
                Signatory Authority’s Details
              </Typography>
              <Box mt={0.25}>
                <Tooltip title={SIGNATORY_DETAILS_HINT}>
                  <InfoIcon color="info" fontSize="small" cursor="pointer" />
                </Tooltip>
              </Box>
            </Stack>
            <DataItem
              title="First Name"
              value={record.profile.signatoryGivenName}
              sxValue={sx.value}
            />
            <DataItem
              title="Last Name"
              value={record.profile.signatoryFamilyName}
              sxValue={sx.value}
            />
            <DataItem title="Job Title" value={record.profile.signatoryTitle} sxValue={sx.value} />
            <DataItem
              title="Email"
              value={record.profile.signatoryEmail}
              sxValue={sx.value}
              hint={SIGNATORY_EMAIL_HINT}
            />
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
};

const sx = {
  value: {
    wordBreak: 'break-word',
    fontWeight: 600,
  },
};

export default IndividualsShow;
