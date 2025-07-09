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

import { useState, useCallback } from 'react';
import { Form, TextInput, SaveButton, required } from 'react-admin';
// eslint-disable-next-line import/no-extraneous-dependencies
import PropTypes from 'prop-types';
import { Stack } from '@mui/material';
import { useIsIssuingInspection } from '@/pages/services/hooks/useIsIssuingInspection';

import Popup from '../common/Popup.jsx';
import { validateServiceEndpoint } from '../organizations/CreateOrganization.utils';

const ServicesEdit = ({ onClose, onSave, selectedService, InterceptOnCreate }) => {
  const { isIssuingOrInspection, isCAO } = useIsIssuingInspection({ id: selectedService?.type });
  const [isInterceptOnCreateOpen, setIsInterceptOnCreateOpen] = useState(false);
  const [selectedCAO, setSelectedCAO] = useState(
    isIssuingOrInspection ? selectedService?.serviceEndpoint.split('#')[0] : null,
  );
  const handleOnSave = useCallback(
    (data) => {
      onSave(data);
      if (InterceptOnCreate) {
        setSelectedCAO(() => data.serviceEndpoint.split('#')[0]);
        setIsInterceptOnCreateOpen(() => true);
      }
    },
    [onSave, InterceptOnCreate],
  );

  const handleOnClose = useCallback(() => {
    setIsInterceptOnCreateOpen(false);
    onClose();
  }, [onClose]);

  const isModifyingServiceEnabled = !!InterceptOnCreate;

  return (
    <>
      <Popup
        title="Edit your service details here:"
        onClose={onClose}
        isOpen={Boolean(selectedService)}
      >
        <Form
          record={{ serviceEndpoint: selectedService?.serviceEndpoint }}
          onSubmit={handleOnSave}
          mode="onChange"
        >
          <FormContent
            isIssuingOrInspection={isIssuingOrInspection}
            isModifyingServiceEnabled={isModifyingServiceEnabled}
          />
        </Form>
      </Popup>
      <InterceptOnCreate
        isInterceptOnCreateOpen={isInterceptOnCreateOpen}
        serviceId={selectedService?.id}
        onNext={() => onClose()}
        onClose={handleOnClose}
        isIssueOrInspection={isIssuingOrInspection}
        selectedCAO={selectedCAO}
        isCAO={isCAO}
      />
    </>
  );
};

const FormContent = ({ isIssuingOrInspection, isModifyingServiceEnabled }) => {
  const validateArray = [required('Service endpoint URL field is required')];
  if (!isIssuingOrInspection) {
    validateArray.push(...validateServiceEndpoint);
  }
  return (
    <Stack>
      <TextInput
        source="serviceEndpoint"
        label="Service endpoint URL"
        validate={validateArray}
        parse={(value) => value.trim()}
      />
      <SaveButton
        variant="outlined"
        icon={null}
        label="Save"
        sx={sx.saveButton}
        alwaysEnable={isModifyingServiceEnabled}
      />
    </Stack>
  );
};

// eslint-disable-next-line better-mutation/no-mutation
FormContent.propTypes = {
  isIssuingOrInspection: PropTypes.bool.isRequired,
  isModifyingServiceEnabled: PropTypes.bool.isRequired,
};

// eslint-disable-next-line better-mutation/no-mutation
ServicesEdit.propTypes = {
  onClose: PropTypes.func,
  onSave: PropTypes.func,
  // eslint-disable-next-line react/forbid-prop-types
  selectedService: PropTypes.object,
  InterceptOnCreate: PropTypes.elementType,
};

const sx = {
  saveButton: { width: 'fit-content', alignSelf: 'center', px: 4, py: 1, mt: 2 },
};

export default ServicesEdit;
