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

import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';

import theme, { FOOTER_HEIGHT } from '../theme/theme';

const Footer = () => {
  return (
    <footer style={styles.footer}>
      <List sx={styles.list} component="nav" aria-label="footer navigation">
        <ListItemButton disabled>
          <ListItemText slotProps={{ primary: { sx: styles.listText } }} primary="CONTACT US" />
        </ListItemButton>
        <ListItemButton
          onClick={() => window.open(`${window.location.origin}/terms-and-conditions`, '_blank')}
        >
          <ListItemText slotProps={{ primary: { sx: styles.listText } }} primary="TERMS OF USE" />
        </ListItemButton>
        <ListItemButton
          onClick={() => window.open(`${window.location.origin}/privacy-policy`, '_blank')}
        >
          <ListItemText slotProps={{ primary: { sx: styles.listText } }} primary="PRIVACY POLICY" />
        </ListItemButton>
      </List>
      <div style={styles.text}>
        All rights reserved {new Date().getFullYear()}
        <img
          src="/assets/images/logo.svg"
          alt="Velocity"
          width={98}
          height={20}
          style={styles.icon}
        />
      </div>
    </footer>
  );
};

export default Footer;

const styles = {
  footer: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 100,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    height: FOOTER_HEIGHT,
    paddingRight: 10,
    backgroundColor: theme.palette.background.default,
    borderTop: `1px solid ${theme.palette.divider.main}`,
  },
  list: {
    display: 'flex',
    color: theme.palette.secondary.light,
  },
  listText: {
    fontWeight: 600,
    fontSize: '12px',
    lineHeight: '16px',
    letterSpacing: '0.5px',
    fontFamily: theme.typography.fontFamily,
  },
  text: {
    fontWeight: 300,
    fontSize: '14px',
    lineHeight: '16px',
    letterSpacing: '0.1px',
    color: theme.palette.secondary.light,
    fontFamily: theme.typography.fontFamily,
  },
  icon: {
    verticalAlign: 'middle',
    color: theme.palette.secondary.light,
    paddingLeft: 30,
    filter:
      'invert(68%) sepia(13%) saturate(102%) hue-rotate(185deg) brightness(89%) contrast(87%)', // filter for #989A9F
  },
};
