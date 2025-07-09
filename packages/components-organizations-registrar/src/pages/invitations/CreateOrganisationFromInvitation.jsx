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

import { Stack, Typography } from '@mui/material';
import { Link as ReactRouterLink, useParams } from 'react-router';
import { useCreateController, useGetOne, useRedirect, useLogout, useRefresh } from 'react-admin';
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import { useEffect, useState, useCallback } from 'react';
import PropTypes from 'prop-types';
import { FOOTER_HEIGHT } from '@/theme/theme';
import CreateOrganisation from '@/components/organizations/CreateOrganization.jsx';
import InvitationServiceInfo from '@/components/invitations/InvitationServiceInfo.jsx';
import Popup from '@/components/common/Popup.jsx';
import Loading from '@/components/Loading.jsx';
import { MESSAGE_CODES } from '@/constants/messageCodes';
import { formatWebSiteUrl, formatRegistrationNumbers, parseJwt } from '@/utils/index.jsx';
import useCountryCodes from '@/utils/countryCodes';
import { dataResources } from '@/utils/remoteDataProvider';
import { useAuth } from '@/utils/auth/AuthContext';
import useSelectedOrganization from '@/state/selectedOrganizationState';
import { SecretKeysPopup } from '../services/components/SecretKeysPopup/index.jsx';

const CreateOrganizationFromInvitation = ({ InterceptOnCreate }) => {
  const { code } = useParams();
  const refresh = useRefresh();
  const redirect = useRedirect();
  const auth = useAuth();
  const { user, getAccessToken } = auth;
  const logout = useLogout();

  const [, setDid] = useSelectedOrganization();
  const { data: countryCodes, isLoading } = useCountryCodes();

  const [hasOrganisations, setHasOrganisations] = useState(false);

  const [isLoader, setIsLoader] = useState(false);
  const [secretKeys, setSecretKeys] = useState(null);
  // popups
  const [isOpenSecretPopup, setIsOpenSecretPopup] = useState(false);
  const [isOpenNotExistingPopup, setIsOpenNotExistingPopup] = useState(false);
  const [isOpenExpiredPopup, setIsOpenExpiredPopup] = useState(false);
  const [isInterceptOnCreateOpen, setIsInterceptOnCreateOpen] = useState(false);

  const { save, saving: creatingIsLoading } = useCreateController({
    resource: 'organizations',
    mutationOptions: {
      onSuccess: async (resp) => {
        refresh();
        setDid(resp.id);
        setSecretKeys({ keys: resp.keys, authClients: resp.authClients });
      },
    },
  });

  const { data: userData, isLoading: isUserDataLoading } = useGetOne(dataResources.USERS, {
    id: user.sub,
  });

  const { data: invitationData, isLoading: invitationIsLoading } = useGetOne(
    'invitations',
    {
      id: code,
    },
    {
      onError: (error) => {
        if (error?.body?.statusCode === 404) {
          setIsOpenNotExistingPopup(true);
        }
        if (
          error?.body?.statusCode === 400 &&
          error?.body?.errorCode === MESSAGE_CODES.INVITATION_EXPIRED
        ) {
          setIsOpenExpiredPopup(true);
        }
      },
    },
  );

  const { data: inviterInfo = { credentialSubject: { name: '' } }, isLoading: isLoadingOrgData } =
    useGetOne(
      dataResources.VERIFIED_PROFILE,
      { id: invitationData?.inviterDid },
      { enabled: !!invitationData?.inviterDid },
    );

  // Check if the user has an organization
  useEffect(() => {
    (async () => {
      try {
        const token = await getAccessToken();
        const tokenDecoded = parseJwt(token);
        setHasOrganisations(
          Boolean(
            tokenDecoded['http://velocitynetwork.foundation/groupId'] ||
              tokenDecoded.scope.includes('admin'),
          ),
        );
      } catch (e) {
        console.error(e);
      }
    })();
  }, [getAccessToken]);

  useEffect(() => {
    const inviteeEmail = invitationData?.inviteeEmail;
    const userEmail = userData?.email;

    if (inviteeEmail && userEmail && userEmail !== inviteeEmail) {
      localStorage.setItem('createInvitationURL', window.location.pathname);
      logout(auth, window.location.href, true);
    }
  }, [userData, invitationData, logout, auth]);

  useEffect(() => {
    if (secretKeys) {
      if (InterceptOnCreate) {
        setIsInterceptOnCreateOpen(true);
      } else {
        setIsOpenSecretPopup(true);
      }
    }
  }, [InterceptOnCreate, secretKeys]);

  const handleSubmit = useCallback(
    async (formData) => {
      await save({
        profile: {
          ...formData,
          website: formatWebSiteUrl(formData.website),
          linkedInProfile: formatWebSiteUrl(formData.linkedInProfile),
          registrationNumbers: formatRegistrationNumbers(formData.registrationNumbers),
        },
        serviceEndpoints: invitationData?.inviteeService,
        invitationCode: code,
      });
    },
    [save, code, invitationData],
  );

  useEffect(() => {
    setIsLoader(isLoading || invitationIsLoading || isLoadingOrgData || isUserDataLoading);
  }, [isLoading, invitationIsLoading, isLoadingOrgData, isUserDataLoading]);

  return (
    <Stack sx={sxStyles.root}>
      <AppBar position="static" sx={sxStyles.appBar}>
        <Toolbar>
          <ReactRouterLink to="/" style={{ display: 'flex' }} role="link">
            <img src="/assets/images/logo.svg" alt="Velocity" />
          </ReactRouterLink>
        </Toolbar>
      </AppBar>
      <Stack sx={{ flexGrow: 1 }}>
        {isLoader ? (
          <Loading sx={sxStyles.loader} />
        ) : (
          <CreateOrganisation
            buttonTitle="Save"
            userData={userData}
            isLoading={creatingIsLoading}
            title="Welcome"
            subTitle={`${inviterInfo.credentialSubject.name} has invited you to join Velocity Network™. Complete/edit your organization
            profile below and click SAVE to complete your registration.`}
            onSubmit={handleSubmit}
            defaultValues={{
              ...invitationData?.inviteeProfile,
              ...invitationData?.keyIndividuals,
            }}
            countryCodes={countryCodes}
            hasOrganisations={hasOrganisations}
          >
            <InvitationServiceInfo inviteeService={invitationData?.inviteeService} />
          </CreateOrganisation>
        )}

        {InterceptOnCreate && (
          <InterceptOnCreate
            isInterceptOnCreateOpen={isInterceptOnCreateOpen}
            serviceId={invitationData?.inviteeService?.[0]?.id}
            // did={did}
            onNext={() => {
              setIsOpenSecretPopup(true);
            }}
            onClose={() => {
              setIsOpenSecretPopup(true);
            }}
            isIssueOrInspection={true}
            selectedCAO={invitationData?.inviterDid}
          />
        )}

        <SecretKeysPopup
          isOpen={isOpenSecretPopup}
          secretKeys={secretKeys}
          onClose={() => {
            setIsOpenSecretPopup(false);
            getAccessToken({ cacheMode: 'off' });
            redirect('/');
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

        <Popup
          isOpen={isOpenNotExistingPopup}
          onClose={() => {
            setIsOpenNotExistingPopup(false);
            redirect('/');
          }}
          title="That invitation link either has been deleted or doesn’t exist"
          mainContainerStyles={sxStyles.errorPopupContainer}
          titleStyles={{ ...sxStyles.errorTitle, ...sxStyles.noInvitation }}
        />
        <Popup
          isOpen={isOpenExpiredPopup}
          onClose={() => {
            setIsOpenExpiredPopup(false);
            redirect('/');
          }}
          title="This invitation link either has expired"
          mainContainerStyles={sxStyles.errorPopupContainer}
          titleStyles={sxStyles.errorTitle}
        >
          <Stack flexDirection="row" justifyContent="center">
            <Typography variant="pl">Ask your service provider to resend the invitation</Typography>
          </Stack>
        </Popup>
      </Stack>
    </Stack>
  );
};

// eslint-disable-next-line better-mutation/no-mutation
CreateOrganizationFromInvitation.propTypes = {
  InterceptOnCreate: PropTypes.elementType,
};

export default CreateOrganizationFromInvitation;

const sxStyles = {
  root: { minHeight: '100vh' },
  loader: { flexGrow: 1, pb: FOOTER_HEIGHT },
  appBar: {
    boxShadow: 'none',
    backgroundColor: 'transparent',
    minHeight: '79px',
    display: 'flex',
    justifyContent: 'center',
  },
  serviceContainer: {
    backgroundColor: (theme) => theme.customColors.grey1,
    borderRadius: '12px',
    p: '32px 40px',
    mt: '25px',
  },
  errorPopupContainer: {
    px: '50px',
  },
  errorTitle: { textAlign: 'center' },
  noInvitation: { p: 0 },
};
