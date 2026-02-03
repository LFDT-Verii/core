import { Stack } from '@mui/material';
import { TextInput, required, SelectArrayInput, FormDataConsumer } from 'react-admin';
import PropTypes from 'prop-types';

import CustomImageInput from '@/components/common/CustomImageInput/index.jsx';
import { validateServiceEndpoint } from '@/components/organizations/CreateOrganizationUtils.js';

const WebWalletSelection = ({ inProgress }) => {
  return (
    <>
      <TextInput
        source="name"
        label="Webwallet Name"
        validate={[required('Webwallet Name field is required')]}
        disabled={inProgress}
      />
      <Stack flexDirection="row" gap={1.75} mb={3.5} mt={1}>
        <FormDataConsumer>
          {({ formData }) => (
            <CustomImageInput
              label={false}
              labelText="Webwallet Logo URL"
              editMode={!formData?.logoUrl}
              imgSrc={formData?.logoUrl}
              orientation="vertical"
              style={{ flexDirection: 'row', minHeight: '240px' }}
              addTo=""
              isRequired
            />
          )}
        </FormDataConsumer>
      </Stack>
      <TextInput
        source="serviceEndpoint"
        label="Webwallet URL"
        validate={[required('Webwallet URL field is required'), ...validateServiceEndpoint]}
        parse={(value) => value?.trim() ?? ''}
        disabled={inProgress}
      />
      <SelectArrayInput
        source="supportedExchangeProtocols"
        choices={[
          { id: 'VN_API', name: 'VN_API' },
          { id: 'OPENID4VC', name: 'OPENID4VC' },
        ]}
        label="Supported Exchange Protocols"
        validate={[required('Supported Exchange Protocols field is required')]}
      />
    </>
  );
};

// eslint-disable-next-line better-mutation/no-mutation
WebWalletSelection.propTypes = {
  inProgress: PropTypes.bool.isRequired,
};

export default WebWalletSelection;
