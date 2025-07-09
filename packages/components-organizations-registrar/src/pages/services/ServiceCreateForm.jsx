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

import { useEffect, useRef, useState, useCallback } from 'react';
import { kebabCase } from 'lodash/string';
import { useRedirect, useCreate, useGetList } from 'react-admin';
import { useLocation, useNavigate } from 'react-router';
import PropTypes from 'prop-types';

import Popup from '@/components/common/Popup.jsx';
import { credentialTypesByServiceTypes } from '@/utils/serviceTypes';
import { dataResources } from '@/utils/remoteDataProvider';
import { getNewServiceIndex } from '@/utils/invitations';
import useSelectedOrganization from '@/state/selectedOrganizationState';
import { useIsIssuingInspection } from './hooks/useIsIssuingInspection';
import { ServiceTypeSelection } from './components/ServiceTypeSelection/index.jsx';
import { ServiceEndpointSelection } from './components/ServiceEndpointSelection/index.jsx';
import { SecretKeysPopup } from './components/SecretKeysPopup/index.jsx';

const defaultAuthClient = { clientSecret: '', clientId: '' };

const ServiceCreateForm = ({ onServiceCreated, services, InterceptOnCreate }) => {
  const { pathname } = useLocation();
  const redirect = useRedirect();
  const navigate = useNavigate();
  const [createService] = useCreate();

  const [did] = useSelectedOrganization();
  const openedStateRef = useRef(true);
  const isModalOpened = /\/services\/create/.test(pathname);

  const [serviceId, setServiceId] = useState('');
  const [selectedCAO, setSelectedCAO] = useState('');

  const { data: credentialAgentOperators, isLoading: isLoadingCAO } = useGetList(
    dataResources.SEARCH_PROFILES,
    {
      filter: { serviceTypes: 'CredentialAgentOperator' },
    },
  );

  const [selectedStep, setSelectedStep] = useState(1);
  const [selectedServiceType, setSelectedServiceType] = useState('');
  const [authClient, setAuthClient] = useState(defaultAuthClient);
  const [createServiceInProgress, setCreateServiceInProgress] = useState(false);

  const [isInterceptOnCreateOpen, setIsInterceptOnCreateOpen] = useState(false);
  const [isKeysPopupOpened, setIsKeysPopupOpened] = useState(false);

  const { isIssuingOrInspection, isCAO } = useIsIssuingInspection(selectedServiceType);

  const onClose = useCallback(() => {
    navigate(-1);
  }, [navigate]);

  // clear previous state after close
  useEffect(() => {
    const reset = () => {
      setSelectedStep(1);
      setSelectedServiceType('');
      setAuthClient(defaultAuthClient);
    };
    if (openedStateRef.current === false && isModalOpened) {
      reset();
    }
    // eslint-disable-next-line better-mutation/no-mutation
    openedStateRef.current = isModalOpened;

    return reset;
  }, [isModalOpened]);

  useEffect(() => {
    if (InterceptOnCreate && serviceId) {
      setIsInterceptOnCreateOpen(true);
    }
  }, [InterceptOnCreate, serviceId]);

  const onCreateService = async ({ serviceEndpoint }) => {
    const type = selectedServiceType.id.match(/.+v1/);
    const kebabType = kebabCase(type[0]);
    const id = `${did}#${kebabType}-${getNewServiceIndex(services, kebabType)}`;
    try {
      setCreateServiceInProgress(true);
      const result = await createService(
        dataResources.SERVICES,
        {
          data: {
            organizationId: did,
            payload: {
              id,
              serviceEndpoint,
              type: type[0],
              credentialTypes: credentialTypesByServiceTypes[selectedServiceType.id],
            },
          },
        },
        { returnPromise: true },
      );
      setCreateServiceInProgress(false);
      setServiceId(result.id);
      if (result.authClient) {
        setAuthClient(result.authClient);
      } else {
        setSelectedCAO(serviceEndpoint.split('#')[0]);
      }
      onServiceCreated();
    } catch (e) {
      setCreateServiceInProgress(false);
    }
  };

  return (
    <>
      <Popup
        onClose={onClose}
        title=""
        isOpen={isModalOpened}
        mainContainerStyles={styles.mainContainer}
        disableCloseButton={createServiceInProgress}
      >
        {selectedStep === 1 && (
          <ServiceTypeSelection
            selectedServiceType={selectedServiceType}
            setSelectedServiceType={setSelectedServiceType}
            isLoading={isLoadingCAO}
            handleNext={() => setSelectedStep(2)}
          />
        )}
        {selectedStep === 2 && (
          <ServiceEndpointSelection
            credentialAgentOperators={credentialAgentOperators}
            isIssueOrInspection={isIssuingOrInspection}
            inProgress={createServiceInProgress}
            onCreate={onCreateService}
            handleBack={() => setSelectedStep(1)}
          />
        )}
      </Popup>

      <InterceptOnCreate
        isInterceptOnCreateOpen={isInterceptOnCreateOpen}
        serviceId={serviceId}
        onNext={() => setIsKeysPopupOpened(true)}
        onClose={() => {
          redirect('list', 'services');
        }}
        isIssueOrInspection={isIssuingOrInspection}
        selectedCAO={selectedCAO}
        isCAO={isCAO}
      />

      <SecretKeysPopup
        isOpen={isKeysPopupOpened}
        secretKeys={{ authClients: [authClient] }}
        onClose={() => {
          setIsKeysPopupOpened(false);
          navigate(-1);
        }}
        wording={{
          title:
            // eslint-disable-next-line max-len
            'Here are your secret identifiers. Please keep a copy of these as they will not be availableonce you close this dialog. You may need to pass this to the admin of your Credential Agent.',
          subtitle: 'Download or copy your secret encryption keys and keep them somewhere safe.',
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
ServiceCreateForm.propTypes = {
  onServiceCreated: PropTypes.func,
  services: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string.isRequired,
    }),
  ).isRequired,
  InterceptOnCreate: PropTypes.elementType,
};

export default ServiceCreateForm;
