import { Stack } from '@mui/material';
import { TextInput, required, SelectArrayInput, FormDataConsumer } from 'react-admin';
import PropTypes from 'prop-types';

import CustomImageInput from '@/components/common/CustomImageInput/index.jsx';
import { validateServiceEndpoint } from '@/components/organizations/CreateOrganizationUtils.js';

const HolderWalletSelection = ({ inProgress }) => {
  return (
    <>
      <TextInput
        source="name"
        label="App Wallet Name"
        validate={[required('App Wallet Name field is required')]}
        disabled={inProgress}
      />
      <Stack flexDirection="row" gap={1.75} mb={3.5} mt={1}>
        <FormDataConsumer>
          {/* eslint-disable-next-line complexity */}
          {({ formData }) => (
            <CustomImageInput
              label={false}
              labelText="App Wallet Logo URL"
              editMode={!formData?.logoUrl}
              orientation="vertical"
              style={{ flexDirection: 'row', minHeight: '240px' }}
              addTo=""
              imgSrc={formData?.logoUrl}
              isRequired
            />
          )}
        </FormDataConsumer>
      </Stack>
      <TextInput
        source="serviceEndpoint"
        label="App landing page"
        validate={[required('App landing page field is required'), ...validateServiceEndpoint]}
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
      <TextInput
        source="playStoreUrl"
        label="Play Store URL"
        validate={[required('Play Store URL field is required'), ...validateServiceEndpoint]}
        parse={(value) => value?.trim() ?? ''}
        disabled={inProgress}
      />
      <TextInput
        source="googlePlayId"
        label="Google Play ID"
        validate={[required('Google Play ID field is required')]}
        parse={(value) => value?.trim() ?? ''}
        disabled={inProgress}
      />
      <TextInput
        source="appleAppStoreUrl"
        label="Apple App Store URL"
        validate={[required('Apple App Store URL field is required'), ...validateServiceEndpoint]}
        parse={(value) => value?.trim() ?? ''}
        disabled={inProgress}
      />
      <TextInput
        source="appleAppId"
        label="Apple App ID"
        validate={[required('Apple App ID field is required')]}
        parse={(value) => value?.trim() ?? ''}
        disabled={inProgress}
      />
    </>
  );
};

// eslint-disable-next-line better-mutation/no-mutation
HolderWalletSelection.propTypes = {
  inProgress: PropTypes.bool.isRequired,
};

export default HolderWalletSelection;
