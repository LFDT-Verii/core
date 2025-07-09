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

import { useMemo } from 'react';
import { useSearchParams } from 'react-router';
import { Box, Button, Container, Stack, Typography } from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import { useGetOne, useRedirect, useUpdate } from 'react-admin';

import PropTypes from 'prop-types';
import ListItem from '@/components/common/ListItem.jsx';
import Loading from '@/components/Loading.jsx';
import ServicesEdit from '@/components/services/ServicesEdit.jsx';
import ServicesDelete from '@/components/services/ServicesDelete.jsx';
import useSelectedOrganization from '@/state/selectedOrganizationState';
import { dataResources } from '@/utils/remoteDataProvider';
import useParticipantAgreementState from '@/state/participantAgreementState';
import ServiceCreateForm from './ServiceCreateForm.jsx';
import { serviceTypeTitlesMap } from '../../utils/serviceTypes';
import useDeleteService from './useDeleteService';

const SAVE_ERROR_MESSAGE =
  'We were unable to update your service with the details provided.  Please check to ensure you have provided valid information and then try again.';

const getAmountTitle = (total) => `${total} active service${total > 1 ? 's' : ''}`;

const ServicesList = ({
  // override props, defaulting to your internal components
  EditComponent = ServicesEdit,
  CreateComponent = ServiceCreateForm,
  DeleteComponent = ServicesDelete,
  AdditionalServiceProperties = {},
}) => {
  const [params, setParams] = useSearchParams();
  const currentlyEditableServiceId = params.get('id');
  const [did] = useSelectedOrganization();

  const [, setParticipantAgreementApproved] = useParticipantAgreementState();

  const {
    data,
    isLoading,
    isFetching,
    refetch: refetchOrganizationServices,
  } = useGetOne('organizations', { id: did }, { enabled: !!did });

  const { handleServiceDeleteConfirm, isDeletingService, serviceToDelete, setServiceToDelete } =
    useDeleteService(refetchOrganizationServices);

  const services = useMemo(() => data?.didDoc?.service || [], [data?.didDoc?.service]);
  const servicesActivated = useMemo(
    () =>
      services.map((item) => ({
        ...item,
        activated: data?.activatedServiceIds?.includes(item.id) || false,
      })),
    [services, data],
  );

  const totalActivatedServices = servicesActivated.filter(({ activated }) => activated).length;
  const currentlyEditableService = useMemo(
    () =>
      currentlyEditableServiceId
        ? services.find((item) => item.id === currentlyEditableServiceId)
        : null,
    [services, currentlyEditableServiceId],
  );

  const [updateService] = useUpdate(undefined, undefined, {
    onSuccess: () => {
      setParticipantAgreementApproved(true);

      refetchOrganizationServices();
    },
  });

  const serviceTitle = (service) => {
    if (service.type === 'VlcContactIssuer_v1') {
      if (service.credentialTypes?.includes('EmailV1.0')) {
        return 'Primary Source Email Issuer (eg. Email Service Provider)';
      }
      return 'Primary Source Phone Issuer (eg. Telco)';
    }
    return serviceTypeTitlesMap[service.type] || service.type;
  };

  // eslint-disable-next-line consistent-return
  const onSave = async ({ serviceEndpoint }) => {
    try {
      await updateService(
        dataResources.SERVICES,
        {
          id: currentlyEditableService.id,
          data: {
            organizationId: did,
            payload: {
              serviceEndpoint,
            },
          },
        },
        { returnPromise: true },
      );
    } catch (e) {
      return {
        serviceEndpoint: SAVE_ERROR_MESSAGE,
      };
    }
  };

  const editAction = useMemo(
    () => ({
      title: 'EDIT',
      icon: <EditIcon />,
      action: (id) => setParams({ id }),
    }),
    [setParams],
  );

  const deleteAction = useMemo(
    () => ({
      title: 'DELETE',
      icon: <DeleteIcon />,
      action: (id) => setServiceToDelete(id),
    }),
    [setServiceToDelete],
  );

  const isLoadingVisible = isLoading || isFetching;

  const redirect = useRedirect();
  const handleCloseEdit = () => {
    setParams({});
  };

  return (
    <Container maxWidth="xl" sx={{ mt: 5 }}>
      <Typography variant="h3">Manage Services</Typography>
      <Box sx={{ mt: 2, mb: 4, maxWidth: '720px' }}>
        <Typography variant="subtitle1">
          Setup the services your organization is to be offering across the Velocity Network™:
          Issuing, Verifying, Operating a Credential Agent and/or operating a Node.
        </Typography>
      </Box>
      <Stack
        sx={{ mb: 2 }}
        flexDirection="row"
        justifyContent="space-between"
        alignItems="flex-end"
      >
        <Button variant="outlined" onClick={() => redirect('create', 'services')}>
          Add service +
        </Button>
        {!!totalActivatedServices && (
          <Typography color="secondary.light" sx={{ fontSize: 14 }}>
            {getAmountTitle(totalActivatedServices)}
          </Typography>
        )}
      </Stack>
      {isLoadingVisible && <Loading sx={{ pt: '60px' }} />}
      {!isLoadingVisible &&
        servicesActivated.map((service) => (
          <ListItem
            key={service.id}
            id={service.id}
            title={serviceTitle(service)}
            status={
              service.activated
                ? { title: 'ACTIVATED', color: 'primary.success' }
                : { title: 'INACTIVE', color: 'primary.main' }
            }
            showActions
            actions={[editAction, deleteAction]}
            content={[
              [
                { name: 'service id', value: service.id },
                { name: 'service endpoint', value: service.serviceEndpoint },
                ...(service.credentialTypes
                  ? [
                      {
                        name: 'credential types',
                        value: service.credentialTypes.join(', '),
                      },
                    ]
                  : []),
                ...(AdditionalServiceProperties && AdditionalServiceProperties[service.type]
                  ? [
                      {
                        name: AdditionalServiceProperties[service.type]?.name,
                        value: AdditionalServiceProperties[service.type]?.value,
                      },
                    ]
                  : []),
              ],
            ]}
          />
        ))}
      <EditComponent
        onClose={handleCloseEdit}
        onSave={onSave}
        selectedService={currentlyEditableService}
      />
      <CreateComponent onServiceCreated={refetchOrganizationServices} services={services} />
      <DeleteComponent
        isLoading={isDeletingService}
        onClose={() => setServiceToDelete(null)}
        onConfirm={handleServiceDeleteConfirm}
        selectedService={serviceToDelete}
      />
    </Container>
  );
};
// eslint-disable-next-line better-mutation/no-mutation
ServicesList.propTypes = {
  EditComponent: PropTypes.elementType,
  CreateComponent: PropTypes.elementType,
  DeleteComponent: PropTypes.elementType,
  AdditionalServiceProperties: PropTypes.object,
};

export default ServicesList;
