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

import { useCallback } from 'react';
import PropTypes from 'prop-types';
// eslint-disable-next-line import/no-extraneous-dependencies
import clsx from 'clsx';
import FormControlLabel from '@mui/material/FormControlLabel';
import FormHelperText from '@mui/material/FormHelperText';
import FormGroup from '@mui/material/FormGroup';

import { FieldTitle, sanitizeInputRestProps, InputHelperText, useInput } from 'react-admin';
import { Checkbox } from '@mui/material';

const CustomBooleanInput = (props) => {
  const {
    className,
    row = false,
    defaultValue = false,
    format,
    label,
    helperText,
    onBlur,
    onChange,
    onFocus,
    disabled,
    parse,
    resource,
    source,
    validate,
    options,
    sx,
    ...rest
  } = props;
  const {
    id,
    field,
    isRequired,
    fieldState: { error, invalid, isTouched },
    formState: { isSubmitted },
  } = useInput({
    defaultValue,
    format,
    parse,
    resource,
    source,
    onBlur,
    onChange,
    type: 'checkbox',
    validate,
    ...rest,
  });

  const handleChange = useCallback(
    (event) => {
      field.onChange(event);
      // Ensure field is considered as touched
      field.onBlur();
    },
    [field],
  );

  return (
    <FormGroup className={clsx('ra-input', `ra-input-${source}`, className)} row={row} sx={sx}>
      <FormControlLabel
        control={
          <Checkbox
            id={id}
            name={field.name}
            color="primary"
            onChange={handleChange}
            onFocus={onFocus}
            checked={field.value}
            {...sanitizeInputRestProps(rest)}
            {...options}
            disabled={disabled}
            sx={{ mr: 4, ml: '9px', p: 0 }}
          />
        }
        label={
          <FieldTitle label={label} source={source} resource={resource} isRequired={isRequired} />
        }
      />
      <FormHelperText error={(isTouched || isSubmitted) && invalid}>
        <InputHelperText
          touched={isTouched || isSubmitted}
          error={error?.message}
          helperText={helperText}
        />
      </FormHelperText>
    </FormGroup>
  );
};

// eslint-disable-next-line better-mutation/no-mutation
CustomBooleanInput.propTypes = {
  className: PropTypes.string,
  row: PropTypes.bool,
  defaultValue: PropTypes.bool,
  format: PropTypes.func,
  label: PropTypes.oneOfType([PropTypes.string, PropTypes.node]),
  helperText: PropTypes.node,
  options: {},
  disabled: false,
  onFocus: PropTypes.func,
  onBlur: PropTypes.func,
  onChange: PropTypes.func,
  parse: PropTypes.func,
  resource: PropTypes.string,
  source: PropTypes.string,
  validate: PropTypes.oneOfType([PropTypes.func, PropTypes.array]),
  sx: PropTypes.object,
};

// eslint-disable-next-line better-mutation/no-mutation
CustomBooleanInput.defaultProps = {
  options: {},
};

export default CustomBooleanInput;
