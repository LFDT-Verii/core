import { useCallback, useState } from 'react';
import { useSearchParams } from 'react-router';
import { useGetOne, useRedirect, useCreate } from 'react-admin';
import { Box, Button, Typography } from '@mui/material';
import { kebabCase } from 'lodash/string';

import { credentialTypesByServiceTypes } from '../../utils/serviceTypes';
import InvitationServiceInfo from '../../components/invitations/InvitationServiceInfo.jsx';
import Popup from '../../components/common/Popup.jsx';
import { dataResources } from '../../utils/remoteDataProvider';
import Loading from '../../components/Loading.jsx';
import { getNewServiceIndex } from '../../utils/invitations';

const InvitationExistingOrgPopup = () => {
  const [searchParams] = useSearchParams();
  const redirect = useRedirect();
  const code = searchParams.get('code');
  const isModalOpened = !!code;

  const [createService] = useCreate();
  const [loading, setLoading] = useState(false);

  const { data: invitationData, isLoading } = useGetOne(
    dataResources.INVITATIONS,
    { meta: { code } },
    { enabled: !!code },
  );

  const handleClose = useCallback(() => {
    redirect('/invitations');
  }, [redirect]);

  const handleSave = useCallback(async () => {
    try {
      setLoading(true);
      const inviteeService = invitationData.inviteeService[0];
      const kebabType = kebabCase(inviteeService.type);
      const result = await createService(
        dataResources.SERVICES,
        {
          data: {
            organizationId: invitationData.inviterDid,
            payload: {
              id: `${invitationData.inviterDid}#${kebabType}-${getNewServiceIndex(
                invitationData.inviteeService,
                kebabType,
              )}`,
              serviceEndpoint: inviteeService.serviceEndpoint,
              type: inviteeService.type,
              credentialTypes: credentialTypesByServiceTypes[inviteeService.type],
            },
          },
        },
        { returnPromise: true },
      );

      if (result) {
        setLoading(false);
        handleClose();
      }
    } catch (e) {
      setLoading(false);
    }
  }, [createService, handleClose, invitationData]);

  return (
    <Popup
      onClose={handleClose}
      title="Invitation"
      isOpen={isModalOpened}
      mainContainerStyles={styles.mainContainer}
      titleStyles={styles.title}
    >
      {isLoading && !invitationData ? (
        <Box style={styles.modalContainer}>
          <Loading />
        </Box>
      ) : (
        <>
          <Typography variant="pl">{invitationData?.inviteeProfile?.name} invited</Typography>
          <InvitationServiceInfo
            inviteeService={invitationData?.inviteeService}
            agreementStyles={styles.agreement}
          />
          <Box display="flex" justifyContent="center" pt={4}>
            <Button
              variant="outlined"
              color="secondary"
              size="large"
              sx={styles.cancelButton}
              onClick={handleClose}
            >
              Cancel
            </Button>
            <Button
              variant="outlined"
              color="primary"
              size="large"
              sx={styles.cancelButton}
              onClick={handleSave}
              isLoading={loading}
            >
              {loading ? <Loading color="error" sx={{ pl: '10px' }} size={26} /> : 'Save'}
            </Button>
          </Box>
        </>
      )}
    </Popup>
  );
};

const styles = {
  mainContainer: { pt: 2, paddingTop: '40px !important' },
  modalContainer: {
    width: '524px',
  },
  title: {
    paddingBottom: '12px',
  },
  agreement: { textAlign: 'start' },
  cancelButton: {
    minWidth: 160,
    mr: 2,
  },
};

export default InvitationExistingOrgPopup;
