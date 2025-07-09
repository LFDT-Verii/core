import { Typography } from '@mui/material';
import { useConfig } from '@/utils/ConfigContext';

export const OrganizationCreateTitle = () => {
  const config = useConfig();

  return (
    <>
      <Typography variant="h1" mb={2} textAlign="center">
        Let’s get your organization registered on The Velocity Network™ {config.chainName}.
      </Typography>
      <Typography variant="pl" mb={6.5} textAlign="center">
        To start, fill in the form below to allow other Network participants to identify your
        organization.
      </Typography>
    </>
  );
};

export default OrganizationCreateTitle;
