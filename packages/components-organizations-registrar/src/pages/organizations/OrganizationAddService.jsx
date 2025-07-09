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

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useGetList } from 'react-admin';
import PropTypes from 'prop-types';
import { kebabCase } from 'lodash/string';

import Loading from '../../components/Loading.jsx';
import Popup from '../../components/common/Popup.jsx';
import { credentialTypesByServiceTypes } from '../../utils/serviceTypes';
import { dataResources } from '../../utils/remoteDataProvider';

import { ServiceEndpointSelection } from '../services/components/ServiceEndpointSelection/index.jsx';
import { ServiceTypeSelection } from '../services/components/ServiceTypeSelection/index.jsx';
import { SecretKeysPopup } from '../services/components/SecretKeysPopup/index.jsx';
import { useIsIssuingInspection } from '../services/hooks/useIsIssuingInspection';

const OrganizationAddService = ({
  isModalOpened,
  isSending,
  onCreate,
  isCreated,
  secretKeys,
  onClose,
  // did,
  selectedServiceType,
  setSelectedServiceType,
  selectedCAO,
  setSelectedCAO,
  InterceptOnCreate,
}) => {
  const [selectedStep, setSelectedStep] = useState(1);
  const [isKeysPopupOpened, setIsKeysPopupOpened] = useState(false);
  const [isInterceptOnCreateOpen, setIsInterceptOnCreateOpen] = useState(false);

  const serviceId = useMemo(() => {
    if (selectedServiceType) {
      const type = selectedServiceType.id.match(/.+v1/);
      return `${kebabCase(type[0])}-1`;
    }
    return '';
  }, [selectedServiceType]);

  const openedStateRef = useRef(isModalOpened);

  const { isIssuingOrInspection, isCAO } = useIsIssuingInspection(selectedServiceType);

  const { data: credentialAgentOperators, isLoading: isLoadingCAO } = useGetList(
    dataResources.SEARCH_PROFILES,
    {
      filter: { serviceTypes: 'CredentialAgentOperator' },
    },
  );

  // clear previous state after close
  useEffect(() => {
    const reset = () => {
      setSelectedStep(1);
    };
    if (openedStateRef.current === false && isModalOpened && !isCreated) {
      reset();
    }

    // eslint-disable-next-line better-mutation/no-mutation
    openedStateRef.current = isModalOpened;
    return reset;
  }, [isModalOpened, isCreated]);

  useEffect(() => {
    if (InterceptOnCreate && isCreated) {
      setIsInterceptOnCreateOpen(true);
    }
  }, [InterceptOnCreate, isCreated]);

  const onCreateCallback = useCallback(
    ({ serviceEndpoint }) => {
      const type = selectedServiceType.id.match(/.+v1/);
      setSelectedCAO(serviceEndpoint.split('#')[0]);
      onCreate({
        serviceEndpoint,
        type: type[0],
        ...(selectedServiceType.id.includes('Issuing') && {
          credentialTypes: credentialTypesByServiceTypes[selectedServiceType.id],
        }),
      });
    },
    [onCreate, selectedServiceType.id, setSelectedCAO],
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

        {selectedStep === 1 && (
          <ServiceTypeSelection
            handleNext={() => setSelectedStep(2)}
            isLoading={isLoadingCAO}
            selectedServiceType={selectedServiceType}
            setSelectedServiceType={setSelectedServiceType}
            onDoLater={() => {
              onCreate(null);
            }}
          />
        )}
        {selectedStep === 2 && (
          <ServiceEndpointSelection
            credentialAgentOperators={credentialAgentOperators}
            isIssueOrInspection={isIssuingOrInspection}
            inProgress={isSending}
            onCreate={onCreateCallback}
            handleBack={() => setSelectedStep(1)}
          />
        )}
      </Popup>

      <InterceptOnCreate
        isInterceptOnCreateOpen={isInterceptOnCreateOpen}
        serviceId={serviceId}
        onNext={() => setIsKeysPopupOpened(true)}
        onClose={() => setIsKeysPopupOpened(true)}
        isIssueOrInspection={isIssuingOrInspection}
        selectedCAO={selectedCAO}
        isCAO={isCAO}
      />

      <SecretKeysPopup
        isOpen={isKeysPopupOpened}
        secretKeys={secretKeys}
        onClose={() => {
          setIsKeysPopupOpened(false);
          onClose();
        }}
        wording={{
          title: 'Your organization is now registered on Velocity Network™.',
          subtitle:
            'Please save your organization’s unique keys in a secure location, as they will not be available once you close this window.',
        }}
        warningWording={{
          title: 'You must download a copy of your keys before exiting',
          subtitle:
            'They will not be available again and are critical for managing your organization data.',
        }}
      />
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
  isCreated: PropTypes.bool,
  // eslint-disable-next-line react/forbid-prop-types
  secretKeys: PropTypes.object,
  onClose: PropTypes.func,
  did: PropTypes.string,
  selectedServiceType: PropTypes.shape({
    id: PropTypes.string,
    title: PropTypes.string,
  }),
  setSelectedServiceType: PropTypes.func,
  selectedCAO: PropTypes.string,
  setSelectedCAO: PropTypes.func,
  InterceptOnCreate: PropTypes.func,
};

export default OrganizationAddService;
