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

import React, { useEffect } from 'react';
import { Box, Button, Divider, Paper, Stack, Typography } from '@mui/material';
import Grid from '@mui/material/Grid2';
import PropTypes from 'prop-types';
import EditIcon from '@mui/icons-material/Edit';
import { useParams, useNavigate } from 'react-router';
import { useGetOne, useRedirect } from 'react-admin';
import {
  copyTextToClipboard,
  WEBSITE_HINT_SHORT,
  DID_HINT,
  LINKEDIN_ORGANIZATION_ID,
  SUPPORT_EMAIL_HINT,
  TECHNICAL_EMAIL_HINT,
  DUNS_HINT,
  LEI_HINT,
  NATIONAL_AUTHORITY_HINT,
  ALSO_KNOWN_AS_HINT,
} from '../../utils/index.jsx';
import Loading from '../../components/Loading.jsx';
import OrganizationAvatar from '../../components/common/OrganizationAvatar.jsx';
import useCountryCodes from '../../utils/countryCodes';
import useSelectedOrganization from '../../state/selectedOrganizationState';
import { AuthoritiesList, Authorities, authorityOptions } from '../../constants/messageCodes';
import DataItem from '../../components/common/DataItem.jsx';
import { useAuth } from '../../utils/auth/AuthContext';

// eslint-disable-next-line complexity
const OrganizationShow = () => {
  const [savedDid, setDid] = useSelectedOrganization();
  const { id } = useParams();
  const { getCountryNameByCode } = useCountryCodes();
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

  useEffect(() => {
    if (id !== savedDid) {
      navigate(`/organizations/${savedDid}/show`, { replace: true });
    }
  }, [id, savedDid, navigate]);

  const { getAccessToken } = useAuth();
  const [token, setToken] = React.useState('');
  const [isCopied, setIsCopied] = React.useState(false);

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

  const handleCopyClick = () => {
    copyTextToClipboard(token, (err) => {
      setIsCopied(!err);
    });
  };

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
        <Typography variant="h3">Organization profile</Typography>
        <Button
          variant="outlined"
          onClick={() => redirect('edit', 'organizations', id)}
          startIcon={<EditIcon />}
        >
          Edit Profile
        </Button>
      </Stack>
      <Paper elevation={2} sx={{ p: 6 }}>
        <Grid container spacing={4}>
          <Grid size={{ xs: 4 }}>
            <Box display="flex" alignItems="flex-start" mb={5}>
              <OrganizationAvatar name={record.profile.name} logo={record.profile.logo} size={66} />
            </Box>
            <Typography component="div" mb={1.5} variant="h4" sx={[sx.value, sx.header]}>
              {record.profile.name}
            </Typography>
            <Typography component="div" mb={1.5} variant="pm">
              {getCountryNameByCode(record.profile.location.countryCode)}
            </Typography>
          </Grid>
          <Grid size={{ xs: 8 }}>
            <Grid sx={sx.dataRow} container spacing={4}>
              <Grid size={{ xs: 6 }}>
                <DataItem title="Legal Name" value={record.profile.name} sxValue={sx.value} />
              </Grid>
              <Grid size={{ xs: 6 }}>
                <DataItem
                  title="Website"
                  value={record.profile.website}
                  sxValue={sx.value}
                  hint={WEBSITE_HINT_SHORT}
                />
              </Grid>
              <Grid size={{ xs: 6 }}>
                <DataItem
                  title="Address"
                  value={record.profile.physicalAddress?.line1}
                  sxValue={sx.value}
                />
              </Grid>
              <Grid size={{ xs: 6 }}>
                <DataItem
                  title="Country"
                  value={getCountryNameByCode(record.profile.location.countryCode)}
                  sxValue={sx.value}
                />
              </Grid>
              <Grid size={{ xs: 6 }}>
                <DataItem
                  title="LinkedIn Page"
                  value={record.profile.linkedInProfile}
                  sxValue={sx.value}
                />
              </Grid>
              <Grid size={{ xs: 6 }}>
                <DataItemRegistrationNumbers
                  hint={LINKEDIN_ORGANIZATION_ID}
                  title="LinkedIn Company Page ID"
                  record={record}
                  type="number"
                  fieldType="LinkedIn"
                />
              </Grid>
              <Grid size={{ xs: 6 }}>
                <DataItem
                  title="Support Email"
                  value={record.profile.contactEmail}
                  sxValue={sx.value}
                  hint={SUPPORT_EMAIL_HINT}
                />
              </Grid>
              <Grid size={{ xs: 6 }}>
                <DataItem
                  title="Technical Contact Email"
                  value={record.profile.technicalEmail}
                  sxValue={sx.value}
                  hint={TECHNICAL_EMAIL_HINT}
                />
              </Grid>
              <Grid size={{ xs: 6 }}>
                <DataItemRegistrationNumbers
                  hint={DUNS_HINT}
                  title={authorityOptions[Authorities.DunnAndBradstreet]}
                  type="number"
                  record={record}
                  fieldType={Authorities.DunnAndBradstreet}
                />
              </Grid>
              <Grid size={{ xs: 6 }}>
                <DataItemRegistrationNumbers
                  hint={LEI_HINT}
                  title={authorityOptions[Authorities.GLEIF]}
                  type="number"
                  record={record}
                  fieldType={Authorities.GLEIF}
                />
              </Grid>
              <Grid size={{ xs: 6 }}>
                <DataItemRegistrationNumbers
                  hint={NATIONAL_AUTHORITY_HINT}
                  title={authorityOptions[Authorities.NationalAuthority]}
                  type="number"
                  record={record}
                  fieldType={Authorities.NationalAuthority}
                />
              </Grid>
              <Grid size={{ xs: 6 }}>
                <DataItemRegistrationNumbers
                  hint=""
                  title=""
                  type="uri"
                  record={record}
                  fieldType={Authorities.NationalAuthority}
                />
              </Grid>
            </Grid>
            <Grid size={{ xs: 12 }} sx={sx.dataRow}>
              <DataItem title="DID" value={record.id} hint={DID_HINT} sxValue={sx.value} />
            </Grid>
            {record.didDoc?.alsoKnownAs && (
              <Grid size={{ xs: 12 }}>
                <DataItem
                  title="Also known as"
                  value={record.didDoc.alsoKnownAs}
                  hint={ALSO_KNOWN_AS_HINT}
                  sxValue={sx.value}
                />
              </Grid>
            )}
          </Grid>
        </Grid>
        <Divider sx={{ my: 5 }} />
        <Box>
          <Typography component="div" mb={1} variant="pm">
            Short Description
          </Typography>
          <Typography component="p" variant="pm">
            {record.profile.description || '-'}
          </Typography>
        </Box>
        {!!record.profile?.commercialEntities?.length && (
          <>
            <Typography component="div" mt={4} textTransform="uppercase" variant="pm">
              Commercial Names
            </Typography>
            <Divider sx={{ mt: 2, mb: 5 }} />
            <Grid container spacing={4}>
              {record.profile.commercialEntities.map((commercial) => (
                <Grid
                  item
                  size={{ xs: 4 }}
                  key={commercial.logo}
                  sx={sx.commercials}
                  justifyContent="flex-start"
                  alignItems="center"
                >
                  <Box display="flex">
                    <OrganizationAvatar size={52} name={commercial.name} logo={commercial.logo} />
                  </Box>
                  <Typography>{commercial.name}</Typography>
                </Grid>
              ))}
            </Grid>
          </>
        )}
        <Divider sx={{ my: 5 }} />
        <Box mb={3}>
          <Typography component="div" mb={1} textTransform="uppercase" variant="pm">
            Registrar Access Token
          </Typography>
          <Typography component="p" variant="pm" sx={sx.token}>
            {token}
          </Typography>
        </Box>
        <Button variant="outlined" color="secondary" size="small" onClick={handleCopyClick}>
          {isCopied ? 'COPIED' : 'COPY'}
        </Button>
      </Paper>
    </Box>
  );
};

const DataItemRegistrationNumbers = ({ fieldType, record, type, ...props }) => {
  const transformedValue =
    record?.profile?.registrationNumbers &&
    record?.profile?.registrationNumbers.find(({ authority }) => {
      return authority === fieldType;
    })?.[type];

  return <DataItem {...props} value={transformedValue} sxValue={sx.value} />;
};

// eslint-disable-next-line better-mutation/no-mutation
DataItemRegistrationNumbers.propTypes = {
  // eslint-disable-next-line react/forbid-prop-types
  record: PropTypes.object.isRequired,
  title: PropTypes.string,
  hint: PropTypes.string,
  type: PropTypes.string,
  fieldType: PropTypes.oneOf(AuthoritiesList).isRequired,
};

const sx = {
  avatar: {
    width: '66px',
    height: '66px',
    bgcolor: 'primary.main',
    border: '6px solid white',
  },
  avatarBorder: {
    mb: 5,
    display: 'flex',
    borderRadius: '50%',
    border: (theme) => `1px solid ${theme.palette.divider.main}`,
  },
  token: {
    color: 'text.secondary',
    wordBreak: 'break-all',
  },
  dataRow: {
    mb: 4,
  },
  value: {
    wordBreak: 'break-word',
    fontWeight: 600,
  },
  commercials: { display: 'flex', gap: '1em' },
  title: { height: '1em' },
  header: {
    fontSize: '1.25rem',
    marginBottom: '.75rem',
  },
};

export default OrganizationShow;
