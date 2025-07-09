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

import { useDataProvider, TextInput, regex, maxLength } from 'react-admin';
import PropTypes from 'prop-types';
import { useRef, useState } from 'react';
import { Typography, Box } from '@mui/material';
import { secureUrlRegexp, ERRORS } from '../../utils/index.jsx';

const ValidateTextInput = ({ source, resource, ...props }) => {
  const { debounce: debounceTime = 250, ...rest } = props;
  const errorobj = { message: ' ' };
  const dataProvider = useDataProvider();
  const [isError, setIsError] = useState(false);

  const timeout = useRef(null);

  const validateSecureUrl = [
    regex(secureUrlRegexp, (res) => {
      setIsError(false);
      return res ? 'Secure webhook should be a HTTPS URL' : undefined;
    }),
    maxLength(1024),
  ];

  const debouncedValidation = async (value) => {
    clearTimeout(timeout.current);

    if (!value) {
      setIsError(false);
      return undefined;
    }

    return new Promise((resolve) => {
      // eslint-disable-next-line better-mutation/no-mutation
      timeout.current = setTimeout(async () => {
        const { data } = await dataProvider.create(resource, { data: { secureWebhookUrl: value } });
        if (data && data.status === 400) {
          setIsError(true);
          resolve(errorobj);
        } else {
          resolve(undefined);
          setIsError(false);
        }
      }, debounceTime);
    });
  };

  const validate = [...validateSecureUrl, debouncedValidation];

  return (
    <Box sx={sx.constainer}>
      <TextInput source={source} validate={validate} {...rest} />
      {isError && (
        <Typography variant="caption" component="div" sx={sx.errorMessage}>
          {ERRORS.secureWebHook}
        </Typography>
      )}
    </Box>
  );
};

export default ValidateTextInput;

const sx = {
  constainer: {
    width: '100%',
    position: 'relative',
  },
  errorMessage: {
    color: 'primary.main',
    mt: 0,
    mb: 0.5,
    ml: 1.5,
  },
};

// eslint-disable-next-line better-mutation/no-mutation
ValidateTextInput.propTypes = {
  source: PropTypes.string,
  resource: PropTypes.string,
  errortext: PropTypes.string,
  // eslint-disable-next-line react/forbid-prop-types
  validate: PropTypes.array,
  debounce: PropTypes.number,
};
