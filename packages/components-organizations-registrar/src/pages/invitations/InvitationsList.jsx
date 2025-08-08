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

import { Box, Container, Typography } from '@mui/material';
import { Loop as LoopIcon, Clear as ClearIcon } from '@mui/icons-material';
import { useGetList, useGetOne, useRedirect, useDelete } from 'react-admin';
import { useMemo, useState, useCallback, useEffect, useRef } from 'react';
import useSelectedOrganization from '../../state/selectedOrganizationState';
import InfoBlock from '../../components/common/infoBlock.jsx';
import InvitationsListContainer from '../../components/invitations/InvitationsListContainer.jsx';
import InvitationCreateForm from './InvitationCreateForm.jsx';
import InvitationResend from './InvitationResend.jsx';
import InvitationExistingOrgPopup from './InvitationExistingOrgPopup.jsx';
import { dataResources } from '../../utils/remoteDataProvider';

const INVITATIONS_UNAVAILABLE =
  'This feature is only available to organizations that have set up a Credential Agent Operator service.';

const InvitationsList = () => {
  const redirect = useRedirect();
  const [did] = useSelectedOrganization();
  const { data: organizationData, isLoading: isLoadingOrganization } = useGetOne(
    'organizations',
    { id: did },
    { enabled: !!did },
  );

  const [page, setPage] = useState(0);

  const {
    data,
    isLoading,
    refetch: refetchInvitationsList,
  } = useGetList('invitations', { meta: { id: did, skip: page }, enabled: !!did });

  const [invitationToResend, setInvitationToResend] = useState(null);
  const [inviteeEmail, setInviteeEmail] = useState(null);
  const [invitationToDelete, setInvitationToDelete] = useState(null);

  // TODO Paging should be fixed after API invitations returns total
  const handleChangePage = useCallback((nextpage) => {
    setPage(nextpage);
  }, []);

  const [deleteOne] = useDelete(
    dataResources.INVITATIONS,
    {
      id: invitationToDelete,
      meta: { organizationId: did },
    },
    {
      onSettled: () =>
        refetchInvitationsList().finally(() => {
          setInvitationToDelete(null);
        }),
    },
  );

  const timerId = useRef(null);
  useEffect(() => {
    if (invitationToDelete) {
      // eslint-disable-next-line better-mutation/no-mutation
      timerId.current = setTimeout(() => {
        deleteOne();
      }, 5000);
    } else {
      clearTimeout(timerId.current);
    }
    return () => {
      clearTimeout(timerId.current);
      if (invitationToDelete) {
        deleteOne();
      }
    };
  }, [invitationToDelete, deleteOne]);

  const withdrawAction = useMemo(
    () => ({
      title: 'WITHDRAW',
      icon: <ClearIcon />,
      action: (id) => {
        setInvitationToDelete(id);
      },
    }),
    [setInvitationToDelete],
  );

  const resendAction = useMemo(
    () => ({
      title: 'RESEND',
      icon: <LoopIcon />,
      action: (id) => {
        setInvitationToResend(id);
        setInviteeEmail(data.find((item) => item.id === id).inviteeEmail);
        redirect(`${id}/resend/`, 'invitations');
      },
    }),
    [data, redirect, setInvitationToResend, setInviteeEmail],
  );

  const isCredentialAgentOperator =
    !!organizationData &&
    organizationData.profile.permittedVelocityServiceCategory.includes('CredentialAgentOperator');
  return (
    <Container maxWidth="xl" sx={{ mt: 5 }}>
      <Typography variant="h3">Invitations</Typography>
      <Box sx={{ mt: 2, mb: 4 }}>
        <Typography variant="subtitle1">
          Manage your sent invitations below by viewing the status of each invitation and resending
          or withdrawing pending invitations.
        </Typography>
      </Box>

      {isCredentialAgentOperator && !isLoading && (
        <InvitationsListContainer
          invitations={data}
          invitationToDelete={invitationToDelete}
          onUndoDelete={() => setInvitationToDelete(null)}
          withdrawAction={withdrawAction}
          resendAction={resendAction}
          onCreateInvite={() => redirect('./create/step-1')}
          changePage={handleChangePage}
          currentPage={page}
        />
      )}

      {!isCredentialAgentOperator && !isLoadingOrganization && (
        <InfoBlock text={INVITATIONS_UNAVAILABLE} />
      )}

      <InvitationCreateForm />
      <InvitationResend selectedInvitation={invitationToResend} inviteeEmail={inviteeEmail} />
      <InvitationExistingOrgPopup />
    </Container>
  );
};

export default InvitationsList;
