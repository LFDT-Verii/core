import { useParams, useSearchParams } from 'react-router';
import { Box } from '@mui/material';

import { useGetOne } from 'ra-core';
import Loading from '@/components/Loading.jsx';
import { dataResources } from '@/utils/remoteDataProvider';
import { useSignatoryResponse } from './hooks/useSignatoryResponse';
import { Wording } from './components/Wording.jsx';

const SignatoryLanding = () => {
  const { response } = useParams();
  const [searchParams] = useSearchParams();
  const did = searchParams.get('did');
  const authCode = searchParams.get('authCode');

  const { data: profile, isLoading } = useGetOne(dataResources.VERIFIED_PROFILE, { id: did });

  const { isLoading: isSignatoryLoading, errorCode } = useSignatoryResponse({
    did,
    authCode,
    response,
  });

  if (isLoading || isSignatoryLoading) {
    return (
      <Box sx={styles.loading} pt={5} pb={10} pr={8} pl={9}>
        <Loading />
      </Box>
    );
  }

  return (
    <Box sx={styles.container}>
      <Box sx={styles.content}>
        <img
          src="/assets/images/logo.svg"
          alt="Velocity"
          width={196}
          height={42}
          style={styles.image}
        />
        <Wording response={response} errorCode={errorCode} name={profile.credentialSubject.name} />
      </Box>
    </Box>
  );
};

const styles = {
  container: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    height: '100vh',
  },
  content: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    transform: 'translateY(-60px)',
    maxWidth: '670px',
  },
  image: {
    marginBottom: 110,
  },
  loading: {
    height: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
};

export default SignatoryLanding;
