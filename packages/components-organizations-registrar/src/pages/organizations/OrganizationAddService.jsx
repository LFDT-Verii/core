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
import { useGetList } from 'react-admin';
import PropTypes from 'prop-types';

import Loading from '../../components/Loading.jsx';
import Popup from '../../components/common/Popup.jsx';
import { dataResources } from '../../utils/remoteDataProvider.js';

import { ServiceEndpointSelection } from '../services/components/ServiceEndpointSelection/index.jsx';
import { ServiceTypeSelection } from '../services/components/ServiceTypeSelection/index.jsx';
import { buildPayload } from '../services/utils/buildPayload.js';

export const ORGANIZATION_ADD_SERVICE_STEPS = {
  SELECT_TYPE: 'selectType',
  CONFIGURE_SERVICE: 'configureService',
};

const OrganizationAddService = ({
  isModalOpened,
  isSending,
  onCreate,
  onDoLater,
  onClose,
  selectedStep,
  setSelectedStep,
  selectedServiceType,
  setSelectedServiceType,
}) => {
  const { data: credentialAgentOperators = [], isLoading: isLoadingCAO } = useGetList(
    dataResources.SEARCH_PROFILES,
    {
      filter: { serviceTypes: 'CredentialAgentOperator' },
    },
  );

  const onCreateCallback = useCallback(
    (service) => {
      const type = selectedServiceType.id.match(/.+v1/);
      onCreate({
        selectedCAO: service.serviceEndpoint.split('#')[0],
        serviceData: buildPayload(service, type[0]),
      });
    },
    [onCreate, selectedServiceType],
  );

  return (
    <>
      <Popup
        onClose={onClose}
        title=""
        isOpen={isModalOpened}
        mainContainerStyles={styles.mainContainer}
        disableCloseButton={isSending}
      >
        {isSending && <Loading color="error" sx={{ pl: '10px' }} size={26} />}

        {selectedStep === ORGANIZATION_ADD_SERVICE_STEPS.SELECT_TYPE && (
          <ServiceTypeSelection
            handleNext={() => setSelectedStep(ORGANIZATION_ADD_SERVICE_STEPS.CONFIGURE_SERVICE)}
            isLoading={isLoadingCAO}
            selectedServiceType={selectedServiceType}
            setSelectedServiceType={setSelectedServiceType}
            onDoLater={onDoLater}
          />
        )}
        {selectedStep === ORGANIZATION_ADD_SERVICE_STEPS.CONFIGURE_SERVICE &&
          selectedServiceType && (
            <ServiceEndpointSelection
              credentialAgentOperators={credentialAgentOperators}
              selectedServiceType={selectedServiceType}
              inProgress={isSending}
              onCreate={onCreateCallback}
              showBackButton={false}
            />
          )}
      </Popup>
    </>
  );
};

const styles = {
  mainContainer: { pt: 2 },
};

// eslint-disable-next-line better-mutation/no-mutation
OrganizationAddService.propTypes = {
  isModalOpened: PropTypes.bool,
  isSending: PropTypes.bool,
  onCreate: PropTypes.func,
  onDoLater: PropTypes.func,
  onClose: PropTypes.func,
  selectedStep: PropTypes.string.isRequired,
  setSelectedStep: PropTypes.func.isRequired,
  selectedServiceType: PropTypes.shape({
    id: PropTypes.string,
    title: PropTypes.string,
  }),
  setSelectedServiceType: PropTypes.func,
};

export default OrganizationAddService;
