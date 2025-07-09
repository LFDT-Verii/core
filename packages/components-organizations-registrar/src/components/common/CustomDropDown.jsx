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

import { FormControl, InputLabel, Select, MenuItem } from '@mui/material';
import { useEffect } from 'react';
import { useInput } from 'react-admin';
import PropTypes from 'prop-types';

const CustomDropDown = ({
  label,
  value: defaultValue,
  onChange,
  disabled,
  items,
  stringValue: format,
  styleSelect,
  source = '',
  parse = (value) => value,
}) => {
  const labelId = label.replaceAll(' ', '_');
  const {
    field,
    field: { onChange: fieldOnChange },
  } = useInput({ source, defaultValue, onChange, format, parse });
  const handleChange = (event) => {
    fieldOnChange(event.target.value);
  };

  useEffect(() => {
    if (items.length === 1) {
      fieldOnChange(items[0]);
    } else {
      fieldOnChange(defaultValue);
    }
  }, [defaultValue, fieldOnChange, items]);
  return (
    <FormControl fullWidth>
      <InputLabel id={labelId}>{label}</InputLabel>
      <Select
        {...field}
        id={labelId}
        label={label}
        onChange={handleChange}
        value={defaultValue}
        disabled={disabled || items.length === 1}
        sx={styleSelect}
      >
        {items.map((item) => (
          <MenuItem
            key={item?.title || item.id}
            value={item}
            sx={sx.menuItem}
            component="div"
            selected={items.length === 1}
          >
            {format(item)}
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
};

export default CustomDropDown;

const sx = {
  menuItem: {
    lineHeight: 2.5,
    borderBottom: '1px solid rgba(33, 33, 33, 0.08)',
  },
};

// eslint-disable-next-line better-mutation/no-mutation
CustomDropDown.propTypes = {
  label: PropTypes.string.isRequired,
  // eslint-disable-next-line react/forbid-prop-types
  value: PropTypes.any,
  onChange: PropTypes.func,
  disabled: PropTypes.bool,
  // eslint-disable-next-line react/forbid-prop-types
  items: PropTypes.array,
  stringValue: PropTypes.func,
  // eslint-disable-next-line react/forbid-prop-types
  styleSelect: PropTypes.object,
  source: PropTypes.string,
  defaultValue: PropTypes.string,
  parse: PropTypes.func,
};
