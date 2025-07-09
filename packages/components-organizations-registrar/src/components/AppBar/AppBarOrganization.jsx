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
import { useLogout, useRedirect, useGetList } from 'react-admin';
import {
  Box,
  Button,
  List,
  ListItem,
  ListItemButton,
  Popover,
  Stack,
  Typography,
} from '@mui/material';
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
import AddIcon from '@mui/icons-material/Add';
import OrganizationAvatar from '../common/OrganizationAvatar.jsx';
import useSelectedOrganization from '../../state/selectedOrganizationState';
import { useIsHideSidebar } from '../../utils/index.jsx';
import useCountryCodes from '../../utils/countryCodes';
import Loading from '../Loading.jsx';
import { useAuth } from '../../utils/auth/AuthContext';

// eslint-disable-next-line complexity
const AppBarOrganization = () => {
  const { getCountryNameByCode } = useCountryCodes();
  const isHidden = useIsHideSidebar();
  const redirect = useRedirect();
  const [did, setDid] = useSelectedOrganization();
  const auth = useAuth();
  const logout = useLogout();

  const { data: allOrganizations, isLoading } = useGetList('organizations', undefined, {
    onSuccess: ({ data }) => {
      if (!data) {
        return;
      }

      if (data.find((item) => item.id === did)) {
        return;
      }

      setDid(data[0].id);
    },
    onError: () => redirect('/'),
  });

  const [anchorEl, setAnchorEl] = React.useState(null);

  const organization = React.useMemo(
    () => (allOrganizations || []).find((item) => item.id === did),
    [did, allOrganizations],
  );

  if (isLoading) {
    return (
      <Box>
        <Loading />
      </Box>
    );
  }

  if (!did || !allOrganizations || isHidden || !organization) {
    return null;
  }

  const isOpen = Boolean(anchorEl);
  const id = isOpen ? 'user-menu' : undefined;

  const handleSelectOrganization = (value) => {
    setDid(value);
    setAnchorEl(null);
    redirect('show', 'organizations', value);
  };

  const handleAddNewClick = () => {
    setAnchorEl(null);
    redirect('create', 'organizations');
  };

  const handleLogoutClick = () => {
    setAnchorEl(null);
    logout(auth, '/', false);
  };

  return (
    <>
      <Stack
        sx={sx.root}
        role="button"
        aria-describedby={id}
        onClick={(e) => setAnchorEl(e.currentTarget)}
        data-testid="app-bar-org"
      >
        <OrganizationAvatar
          size={36}
          name={organization.profile.name}
          logo={organization.profile.logo}
        />
        <Box>
          <Typography variant="pl" component="div" fontWeight={600}>
            {organization.profile.name}
          </Typography>
          <Typography variant="ps" mt={0.25}>
            {getCountryNameByCode(organization.profile.location.countryCode)}
          </Typography>
        </Box>
        <ArrowDropDownIcon />
      </Stack>
      <Popover
        id={id}
        open={isOpen}
        anchorEl={anchorEl}
        onClose={() => setAnchorEl(null)}
        componentsProps={{
          backdrop: {
            invisible: true,
          },
        }}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'right',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
      >
        <Stack sx={sx.popup} alignItems="center">
          <OrganizationAvatar
            size={56}
            name={organization.profile.name}
            logo={organization.profile.logo}
          />
          <Typography mt={2} variant="h5">
            {organization.profile.name}
          </Typography>
          <Typography mt={2} variant="pm" fontWeight="600" sx={sx.did}>
            {did}
          </Typography>
          <Typography variant="ps" mt={1} mb={3}>
            {getCountryNameByCode(organization.profile.location.countryCode)}
          </Typography>
          <List sx={sx.list}>
            {allOrganizations
              .filter((item) => item.id !== did)
              .map((item) => (
                <ListItem key={item.id} sx={sx.listItem} disablePadding>
                  <ListItemButton
                    sx={sx.listItemButton}
                    onClick={() => handleSelectOrganization(item.id)}
                  >
                    <OrganizationAvatar
                      size={26}
                      name={item.profile.name}
                      logo={item.profile.logo}
                    />
                    <Typography variant="pm" fontWeight={600}>
                      {item.profile.name}
                    </Typography>
                  </ListItemButton>
                </ListItem>
              ))}
            <ListItem key="'add-new'" sx={sx.listItem} disablePadding>
              <ListItemButton sx={sx.listItemButton} onClick={handleAddNewClick}>
                <Box sx={sx.plusIcon}>
                  <AddIcon />
                </Box>
                <Typography variant="pm" fontWeight={600} fontSize={12}>
                  ADD ORGANIZATION
                </Typography>
              </ListItemButton>
            </ListItem>
          </List>
          <Button
            sx={sx.logout}
            onClick={handleLogoutClick}
            variant="outlined"
            color="secondary"
            size="small"
          >
            LOG OUT
          </Button>

          <Button sx={sx.changePassword} variant="text" color="secondary" size="small">
            Change password
          </Button>
        </Stack>
      </Popover>
    </>
  );
};

export default AppBarOrganization;

const sx = {
  root: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 1.5,
    cursor: 'pointer',
    py: 1.25,
  },
  popup: {
    minWidth: 368,
    py: 4,
  },
  list: {
    alignSelf: 'stretch',
  },
  listItem: {
    borderTop: (theme) => `1px solid ${theme.palette.divider.main}`,
  },
  listItemButton: {
    gap: 2.5,
    px: 3.25,
    py: 1.5,
  },
  plusIcon: {
    padding: 0.625,
    display: 'flex',
  },
  logout: {
    mt: 1,
    minWidth: 176,
  },
  changePassword: {
    mt: 2,
  },
  did: {
    wordBreak: 'break-word',
    px: '10px',
  },
};
