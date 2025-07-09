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

import { useCallback, useMemo } from 'react';
import { Form, AutocompleteInput, required } from 'react-admin';
import { Box, Stack } from '@mui/material';
import { kebabCase } from 'lodash/string';
import PropTypes from 'prop-types';

import {
  serviceTypesIssuingOrInspection,
  credentialTypesByServiceTypes,
} from '@/utils/serviceTypes';
import OrganizationSubmitButton from '../organizations/OrganisationSubmitButton.jsx';

const SetInvitationService = ({ children, onSubmit, defaultValues, serviceEndpointsOptions }) => {
  const defaultFormData = useMemo(() => {
    if (!defaultValues && serviceEndpointsOptions.length === 1) {
      return { serviceEndpoint: serviceEndpointsOptions?.[0]?.id };
    }
    return defaultValues;
  }, [defaultValues, serviceEndpointsOptions]);

  const handleSubmit = useCallback(
    (data) => {
      const type = data.type.match(/.+v1/);
      const kebabType = kebabCase(type[0]);
      onSubmit({
        ...data,
        type: type[0],
        id: `${kebabType}-1`,
        credentialTypes: credentialTypesByServiceTypes[data.type],
      });
    },
    [onSubmit],
  );

  const autoCompleteInputProps =
    serviceEndpointsOptions.length === 1 ? { InputProps: { disabled: true } } : {};

  return (
    <Form onSubmit={handleSubmit} defaultValues={defaultFormData}>
      <Stack sx={styles.endpointForm}>
        <AutocompleteInput
          label="Select service"
          source="type"
          optionText="title"
          choices={serviceTypesIssuingOrInspection}
          validate={[required()]}
        />
        <AutocompleteInput
          label="Service endpoint"
          source="serviceEndpoint"
          choices={serviceEndpointsOptions}
          TextFieldProps={autoCompleteInputProps}
          validate={[required()]}
        />
        <Box sx={styles.buttonBlock}>
          {children}
          <OrganizationSubmitButton title="Next" styles={styles.button} />
        </Box>
      </Stack>
    </Form>
  );
};

const styles = {
  button: { px: 4, py: 1, fontSize: '16px', width: '160px' },
  buttonBlock: {
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: '40px',
    flex: 1,
  },
  endpointForm: {
    marginTop: '30px',
  },
};

// eslint-disable-next-line better-mutation/no-mutation
SetInvitationService.propTypes = {
  children: PropTypes.node.isRequired,
  onSubmit: PropTypes.func.isRequired,
  // eslint-disable-next-line react/forbid-prop-types
  defaultValues: PropTypes.object,
  serviceEndpointsOptions: PropTypes.arrayOf(
    PropTypes.shape({
      name: PropTypes.string.isRequired,
      id: PropTypes.string.isRequired,
    }),
  ),
};

export default SetInvitationService;
