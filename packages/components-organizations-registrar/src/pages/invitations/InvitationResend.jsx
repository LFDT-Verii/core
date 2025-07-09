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

import { useState, useCallback } from 'react';
import { useUpdate, useRedirect, useRefresh } from 'react-admin';
import { useLocation } from 'react-router-dom';
import PropTypes from 'prop-types';
import { Typography, Button } from '@mui/material';
import useSelectedOrganization from '../../state/selectedOrganizationState';
import { MESSAGE_CODES } from '../../constants/messageCodes';
import { getStatusByCode } from './utils';
import SetInvitationEmail from '../../components/invitations/SetInvitationEmail.jsx';
import Popup from '../../components/common/Popup.jsx';
import StatusPopup from '../../components/common/StatusPopup.jsx';

const DEFAULT_STATUS_STATE = { error: null, title: '' };

const InvitationResend = ({ selectedInvitation, inviteeEmail }) => {
  const [did] = useSelectedOrganization();
  const refresh = useRefresh();
  const [statusPopup, setStatusPopup] = useState(DEFAULT_STATUS_STATE);
  const [isStatusPopupOpen, setStatusPopupOpen] = useState(false);
  const redirect = useRedirect();
  const { pathname } = useLocation();

  const resendInvitationURL = `invitations/${selectedInvitation}/resend`;

  const isModalOpened = new RegExp(resendInvitationURL).test(pathname);

  const onClose = useCallback(() => {
    redirect('/invitations');
  }, [redirect]);

  const handleCloseStatusPopup = useCallback(() => {
    setStatusPopup(DEFAULT_STATUS_STATE);
    onClose();
  }, [onClose]);

  const handleSubmit = async (emailData) => {
    await update(
      'invitations',
      {
        id: selectedInvitation,
        data: {
          organizationId: did,
          payload: {
            ...emailData,
          },
        },
      },
      { returnPromise: true },
    );
  };

  const [update] = useUpdate(undefined, undefined, {
    onSuccess: async (resp) => {
      refresh();
      setStatusPopup({
        error: resp.messageCode === MESSAGE_CODES.INVITATION_SENT ? null : resp.messageCode,
        title: getStatusByCode(resp.messageCode),
      });
      setStatusPopupOpen(true);
    },
    onError: (error) => {
      setStatusPopup({
        error: error?.body?.errorCode || 'bad request',
        title: getStatusByCode(error?.body?.errorCode),
      });
      setStatusPopupOpen(true);
    },
  });

  if (isStatusPopupOpen && statusPopup.title) {
    return (
      <StatusPopup
        isModalOpened={isStatusPopupOpen}
        buttonLabel="Back to invitations"
        title={statusPopup.title}
        subTitle={statusPopup.error}
        error={statusPopup.error}
        onClose={handleCloseStatusPopup}
        onButtonClick={handleCloseStatusPopup}
      />
    );
  }

  return (
    <Popup
      onClose={onClose}
      title=""
      isOpen={isModalOpened}
      mainContainerStyles={styles.mainContainer}
    >
      <Typography variant="h1" mb={2}>
        Email address
      </Typography>
      <Typography pb="30px">Please complete the details below to continue.</Typography>
      <SetInvitationEmail onSubmit={handleSubmit} defaultValue={inviteeEmail}>
        <Button
          variant="outlined"
          color="secondary"
          sx={styles.cancelButton}
          onClick={() => redirect('/invitations')}
        >
          Cancel
        </Button>
      </SetInvitationEmail>
    </Popup>
  );
};

export default InvitationResend;

const styles = {
  mainContainer: { pt: 2 },
  cancelButton: {
    px: 4,
    py: 1,
    fontSize: '16px',
    width: '160px',
    marginRight: '20px',
  },
};

// eslint-disable-next-line better-mutation/no-mutation
InvitationResend.propTypes = {
  selectedInvitation: PropTypes.string,
  inviteeEmail: PropTypes.string,
};
