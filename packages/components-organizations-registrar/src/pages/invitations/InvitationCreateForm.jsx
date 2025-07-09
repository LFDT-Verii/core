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
import { useLocation } from 'react-router';
import { useGetOne, useCreateController, useRedirect, useRefresh } from 'react-admin';
import { Box, Typography, Button } from '@mui/material';
import KeyboardArrowLeftIcon from '@mui/icons-material/KeyboardArrowLeft';
// eslint-disable-next-line import/no-extraneous-dependencies

import Popup from '../../components/common/Popup.jsx';
import CreateInvitationForOrganization from '../../components/organizations/CreateInvitationForOrganization.jsx';
import { CREDENTIAL_TYPES_IDS } from '../../utils/serviceTypes';
import useCountryCodes from '../../utils/countryCodes';
import useSelectedOrganization from '../../state/selectedOrganizationState';
import StatusPopup from '../../components/common/StatusPopup.jsx';
import SetInvitationService from '../../components/invitations/SetInvitationService.jsx';
import { MESSAGE_CODES } from '../../constants/messageCodes';
import SetKeyIndividuals from '../../components/invitations/SetKeyIndividuals.jsx';
import { formatWebSiteUrl, formatRegistrationNumbers } from '../../utils/index.jsx';
import { getStatusByCode } from './utils';

const DEFAULT_STATUS_STATE = { error: null, title: '' };

const InvitationCreateForm = () => {
  const { pathname } = useLocation();
  const redirect = useRedirect();
  const [did] = useSelectedOrganization();
  const refresh = useRefresh();
  const { data: countryCodes } = useCountryCodes();

  const isModalOpened = /\/invitations\/create/.test(pathname);
  const isStep1 = /\/invitations\/create\/step-1/.test(pathname);
  const isStep2 = /\/invitations\/create\/step-2/.test(pathname);
  const isStep3 = /\/invitations\/create\/step-3/.test(pathname);

  const [organizationProfileData, setOrganizationProfileData] = useState(null);
  const [serviceData, setServiceData] = useState(null);
  const [keyIndividualsData, setKeyIndividualsData] = useState(null);

  const [statusPopup, setStatusPopup] = useState(DEFAULT_STATUS_STATE);
  const [isStatusPopupOpen, setIsStatusPopupOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const { data: organisationData } = useGetOne('organizations', { id: did }, { enabled: !!did });
  const serviceEndpointsOptions = useMemo(
    () =>
      (organisationData?.didDoc?.service || []).reduce((acc, { type, id, serviceEndpoint }) => {
        if (type === CREDENTIAL_TYPES_IDS.VLC_CREDENTIAL_AGENT_OPERATOR) {
          return [...acc, { name: `${id} ${serviceEndpoint}`, id: `${did}${id}` }];
        }
        return acc;
      }, []),
    [did, organisationData?.didDoc?.service],
  );
  const openedStateRef = useRef(isModalOpened);

  const onClose = useCallback(
    (_event, reason) => {
      if (reason === 'backdropClick') {
        return;
      }

      setOrganizationProfileData(null);
      redirect('/invitations');
    },
    [redirect],
  );

  const handleCloseStatusPopup = useCallback(() => {
    setStatusPopup(DEFAULT_STATUS_STATE);
    setIsStatusPopupOpen(false);
    onClose();
  }, [onClose]);

  // clear previous state after close
  useEffect(() => {
    if (openedStateRef.current === false && isModalOpened) {
      redirect('/invitations/create/step-1');
      setServiceData(null);
      setKeyIndividualsData(null);
      setOrganizationProfileData(null);
      setStatusPopup(DEFAULT_STATUS_STATE);
    }

    // eslint-disable-next-line better-mutation/no-mutation
    openedStateRef.current = isModalOpened;
  }, [isModalOpened, redirect]);

  useEffect(() => {
    if (
      (!organizationProfileData && (isStep2 || isStep3)) ||
      (isStatusPopupOpen && !statusPopup.title)
    ) {
      redirect('/invitations/create/step-1');
    }
  }, [
    isStatusPopupOpen,
    isStep2,
    isStep3,
    statusPopup.title,
    serviceData,
    organizationProfileData,
    redirect,
  ]);

  const goToCreateServiceStep = (data, authority) => {
    setOrganizationProfileData({
      ...data,
      website: formatWebSiteUrl(data.website),
      linkedInProfile: formatWebSiteUrl(data.linkedInProfile),
      registrationNumbers: formatRegistrationNumbers(data.registrationNumbers, authority),
    });
    redirect('/invitations/create/step-2');
  };

  const goToSetKeyIndividualsStep = (data) => {
    setServiceData(data);
    redirect('/invitations/create/step-3');
  };

  const handleBackToServiceStep = (data) => {
    setKeyIndividualsData(data);
    redirect('/invitations/create/step-2');
  };

  const { save } = useCreateController({
    resource: 'invitations',
    mutationOptions: {
      meta: { id: did },
      onSuccess: async (resp) => {
        refresh();
        if (resp.invitation.code && organizationProfileData?.org?.id) {
          redirect(`/invitations?code=${resp.invitation.code}`);

          return;
        }

        setStatusPopup({
          error: resp.messageCode === MESSAGE_CODES.INVITATION_SENT ? null : resp.messageCode,
          title: getStatusByCode(resp.messageCode),
        });
        setIsStatusPopupOpen(true);
        redirect('/invitations/create/status');
      },
      onError: (error) => {
        setStatusPopup({
          error: error?.body?.errorCode || 'bad request',
          title: getStatusByCode(error?.body?.errorCode),
        });
        setIsStatusPopupOpen(true);
        redirect('/invitations/create/status');
      },
    },
  });

  const handleSubmit = async (data) => {
    setLoading(true);
    const { org, ...inviteeProfile } = organizationProfileData;
    const { signatoryEmail, ...keyIndividuals } = data;

    await save({
      inviteeEmail: data.adminEmail,
      inviteeService: [serviceData],
      inviteeProfile,
      keyIndividuals: {
        ...keyIndividuals,
        ...(signatoryEmail ? { signatoryEmail } : {}),
      },
      inviteeDid: org?.id || undefined,
    });

    setLoading(false);
  };

  return (
    <>
      <Popup
        onClose={onClose}
        title=""
        isOpen={isModalOpened}
        mainContainerStyles={styles.mainContainer}
      >
        <Box sx={{ width: '524px' }}>
          {isStep1 && (
            <>
              <Typography variant="pm" sx={styles.step}>
                Step 1/3
              </Typography>
              <CreateInvitationForOrganization
                buttonTitle="Next"
                onSubmit={goToCreateServiceStep}
                onCancel={onClose}
                defaultValues={organizationProfileData}
                countryCodes={countryCodes}
              />
            </>
          )}
          {isStep2 && (
            <>
              <Typography variant="pm" sx={styles.step}>
                Step 2/3
              </Typography>
              <Typography variant="h1" mb={2}>
                Service
              </Typography>
              <Typography>Please complete the details below to continue</Typography>
              <SetInvitationService
                onSubmit={goToSetKeyIndividualsStep}
                defaultValues={serviceData}
                serviceEndpointsOptions={serviceEndpointsOptions}
              >
                <Button
                  variant="outlined"
                  color="secondary"
                  sx={styles.backButton}
                  onClick={() => redirect('/invitations/create/step-1')}
                  startIcon={<KeyboardArrowLeftIcon />}
                >
                  Back
                </Button>
              </SetInvitationService>
            </>
          )}
          {isStep3 && (
            <>
              <Typography variant="pm" sx={styles.step}>
                Step 3/3
              </Typography>
              <Typography variant="h1" mb={2}>
                Key Individuals
              </Typography>
              <SetKeyIndividuals
                onSubmit={handleSubmit}
                serviceEndpointsOptions={serviceEndpointsOptions}
                defaultValues={keyIndividualsData}
                onBack={handleBackToServiceStep}
                loading={loading}
              />
            </>
          )}
        </Box>
      </Popup>

      <StatusPopup
        isModalOpened={isStatusPopupOpen}
        buttonLabel="Back to invitations"
        title={statusPopup.title}
        subTitle={statusPopup.error}
        error={statusPopup.error}
        onClose={handleCloseStatusPopup}
        onButtonClick={handleCloseStatusPopup}
      />
    </>
  );
};

const styles = {
  mainContainer: { pt: 2 },
  step: { color: (theme) => theme.palette.primary.main, pb: '30px', display: 'block' },
  backButton: {
    px: 4,
    py: 1,
    fontSize: '16px',
    width: '160px',
    marginRight: '20px',
  },
};

export default InvitationCreateForm;
