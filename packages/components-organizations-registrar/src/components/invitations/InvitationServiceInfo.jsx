import PropTypes from 'prop-types';
import { Stack, Box, Typography, Link } from '@mui/material';
import { serviceTypesIssuingOrInspection, CREDENTIAL_TYPES_IDS } from '@/utils/serviceTypes';
import { chainNames } from '@/utils/chainNames';
import { useConfig } from '@/utils/ConfigContext';

const getServiceKey = (key) => {
  switch (key) {
    case 'id': {
      return 'Service ID';
    }
    case 'type': {
      return 'Service type';
    }
    case 'serviceEndpoint': {
      return 'Service endpoint';
    }

    default:
      return key;
  }
};

const getServiceTitle = (value, credentialTypes) => {
  let serviceType;
  if (value === 'VlcContactIssuer_v1') {
    serviceType = credentialTypes.includes('EmailV1.0')
      ? CREDENTIAL_TYPES_IDS.VLC_CONTACT_ISSUER_EMAIL
      : CREDENTIAL_TYPES_IDS.VLC_CONTACT_ISSUER_PHONE;
  } else {
    serviceType = value;
  }
  return serviceTypesIssuingOrInspection.find((item) => item.id === serviceType).title;
};

const InvitationServiceInfo = ({ inviteeService, agreementStyles }) => {
  const config = useConfig();
  return (
    <>
      {inviteeService &&
        inviteeService?.map((service) => {
          return (
            <Stack sx={sxStyles.serviceContainer} key={`service-${service.id}`}>
              {Object.entries(service).map(([serviceKey, value]) => {
                if (serviceKey === 'credentialTypes') {
                  return undefined;
                }

                const serviceValue =
                  serviceKey === 'type' ? getServiceTitle(value, service.credentialTypes) : value;

                return (
                  <Box key={`service-${service.id}-${serviceKey}`} sx={sxStyles.field}>
                    <Typography variant="pm">{getServiceKey(serviceKey)}</Typography>
                    <Typography variant="h5" sx={sxStyles.valueText}>
                      {serviceValue}
                    </Typography>
                  </Box>
                );
              })}
            </Stack>
          );
        })}
      {config.chainName !== chainNames.testnet && (
        <Typography variant="pm" sx={[sxStyles.agreement, agreementStyles]}>
          <span>By clicking Save, you agree to our </span>
          <Link
            target="_blank"
            href="https://www.velocitynetwork.foundation/main2/participation-agreements"
          >
            Participant Agreement
          </Link>
        </Typography>
      )}
    </>
  );
};

// eslint-disable-next-line better-mutation/no-mutation
InvitationServiceInfo.propTypes = {
  // eslint-disable-next-line react/forbid-prop-types
  inviteeService: PropTypes.array,
  // eslint-disable-next-line react/forbid-prop-types
  agreementStyles: PropTypes.array,
};

const sxStyles = {
  serviceContainer: {
    backgroundColor: (theme) => theme.customColors.grey1,
    borderRadius: '12px',
    p: '32px 40px',
    mt: '25px',
  },
  agreement: {
    color: (theme) => theme.customColors.grey2,
    textAlign: 'center',
    mt: 5,
    display: 'block',
  },
  valueText: {
    marginTop: 1,
    'overflow-wrap': 'break-word',
  },
  field: {
    marginBottom: 4,
    '&:last-child': {
      marginBottom: 0,
    },
  },
};

export default InvitationServiceInfo;
