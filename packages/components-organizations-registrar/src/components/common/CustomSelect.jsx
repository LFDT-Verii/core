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

import { List, ListItemButton, Typography } from '@mui/material';
import CheckIcon from '@mui/icons-material/Check';
import PropTypes from 'prop-types';

const CustomSelect = ({ items, selected, onSelect }) => {
  return (
    <List>
      {items.map(({ id, title }) => (
        <ListItemButton
          key={id}
          sx={[sxStyles.listItem, selected === id ? sxStyles.selected : {}]}
          onClick={() => onSelect(id)}
        >
          <Typography sx={sxStyles.title}>{title}</Typography>
          {selected === id ? <CheckIcon sx={sxStyles.icon} /> : null}
        </ListItemButton>
      ))}
    </List>
  );
};

export const sxStyles = {
  listItem: {
    px: '19px',
    minHeight: '67px',
    backgroundColor: '#F5F7FB',
    borderRadius: '4px',
    margin: '2px',
    justifyContent: 'space-between',
    boxSizing: 'border-box',
    '&:hover': {
      borderColor: 'primary.main',
      borderWidth: '1px',
      borderStyle: 'solid',
    },
  },
  selected: {
    borderColor: 'primary.main',
    borderWidth: '1px',
    borderStyle: 'solid',
  },
  title: {
    fontSize: '18px',
    fontWeight: '600',
  },
  icon: {
    color: 'primary.main',
  },
};

// eslint-disable-next-line better-mutation/no-mutation
CustomSelect.propTypes = {
  onSelect: PropTypes.func,
  items: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string,
      title: PropTypes.string,
    }),
  ),
  selected: PropTypes.string,
};

export default CustomSelect;
