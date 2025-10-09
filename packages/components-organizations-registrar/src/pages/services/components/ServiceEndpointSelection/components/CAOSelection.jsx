import { TextInput, required } from 'react-admin';
import PropTypes from 'prop-types';

import { validateServiceEndpoint } from '@/components/organizations/CreateOrganizationUtils.js';

const CAOSelection = ({ inProgress }) => {
  return (
    <TextInput
      source="serviceEndpoint"
      label="Service endpoint URL"
      validate={[required('Service endpoint URL field is required'), ...validateServiceEndpoint]}
      parse={(value) => value?.trim() ?? ''}
      disabled={inProgress}
    />
  );
};

// eslint-disable-next-line better-mutation/no-mutation
CAOSelection.propTypes = {
  inProgress: PropTypes.bool.isRequired,
};

export default CAOSelection;
