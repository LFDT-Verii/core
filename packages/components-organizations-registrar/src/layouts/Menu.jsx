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

import { useEffect } from 'react';
import { Menu as RaMenu, useStore } from 'react-admin';
import Box from '@mui/material/Box';
import { useMediaQuery } from '@mui/material';
import ArrowRightIcon from '@mui/icons-material/ArrowRight';
import { useIsHideSidebar } from '../utils/index.jsx';

const sxStyles = {
  menu: {
    width: 180,
    mt: '35px',
    mb: 1,
    pl: '4px',

    transition: (theme) =>
      theme.transitions.create('width', {
        easing: theme.transitions.easing.sharp,
        duration: theme.transitions.duration.leavingScreen,
      }),
  },
  menuItem: {
    py: '13px',
    color: 'secondary.light',
    width: 160,
    textTransform: 'uppercase',
    fontSize: 14,
    fontWeight: 500,
    lineHeight: '19.6px',
    whiteSpace: 'break-spaces',

    '&.RaMenuItemLink-active': {
      color: 'primary.main',
      '& svg': {
        color: 'primary.main',
      },
    },
  },
};

const Menu = () => {
  const isMenuHidden = useIsHideSidebar();
  const isSmall = useMediaQuery((theme) => theme.breakpoints.down('sm'));
  const [isMenuOpen, setIsMenuOpen] = useStore('sidebar.open');

  useEffect(() => {
    if (!isMenuOpen && !isSmall) {
      setIsMenuOpen(true);
    }
  }, [isMenuOpen, isSmall, setIsMenuOpen]);

  if (isMenuHidden) {
    return null;
  }

  return (
    <Box sx={sxStyles.menu}>
      <RaMenu>
        <RaMenu.Item
          to="/organizations"
          primaryText="Organization profile"
          state={{ _scrollToTop: true }}
          leftIcon={<ArrowRightIcon />}
          sx={sxStyles.menuItem}
        />
        <RaMenu.Item
          to="/individuals"
          primaryText="Key individuals"
          state={{ _scrollToTop: true }}
          leftIcon={<ArrowRightIcon />}
          sx={sxStyles.menuItem}
        />
        <RaMenu.Item
          to="/services"
          primaryText="Services"
          state={{ _scrollToTop: true }}
          leftIcon={<ArrowRightIcon />}
          sx={sxStyles.menuItem}
        />
        {/* <MenuItemLink
        to="/users"
        primaryText="Users"
        state={{ _scrollToTop: true }}
        leftIcon={<ArrowRightIcon />}
        sx={sxStyles.menuItem}
      /> */}
        <RaMenu.Item
          to="/invitations"
          primaryText="Invitations"
          state={{ _scrollToTop: true }}
          leftIcon={<ArrowRightIcon />}
          sx={sxStyles.menuItem}
        />
      </RaMenu>
    </Box>
  );
};

export default Menu;
