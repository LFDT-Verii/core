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

import { Button } from 'react-admin';
import { useEffect } from 'react';
import { useFormContext } from 'react-hook-form';
import PropTypes from 'prop-types';

import Loading from '../Loading.jsx';

const OrganizationSubmitButton = ({ title, isLoading, endIcon, styles, handleState, enabled }) => {
  const form = useFormContext();

  useEffect(() => {
    if (handleState) {
      handleState(form.formState.isValid);
    }
  }, [form.formState.isValid, handleState]);

  return (
    <Button
      disabled={!form.formState.isValid && !enabled}
      variant="outlined"
      color="primary"
      type="submit"
      size="large"
      label={isLoading ? '' : title}
      endIcon={endIcon}
      sx={styles}
    >
      {isLoading && <Loading color="error" sx={{ pl: '10px' }} size={26} />}
    </Button>
  );
};

// eslint-disable-next-line better-mutation/no-mutation
OrganizationSubmitButton.propTypes = {
  title: PropTypes.string.isRequired,
  isLoading: PropTypes.bool,
  endIcon: PropTypes.element,
  // eslint-disable-next-line react/forbid-prop-types
  styles: PropTypes.object,
  handleState: PropTypes.func,
  enabled: PropTypes.bool,
};

export default OrganizationSubmitButton;
