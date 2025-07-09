import { useEffect, useState } from 'react';
import { useGetOne, useRedirect } from 'react-admin';
import { useAuth } from '@/utils/auth/AuthContext';
import { dataResources } from '@/utils/remoteDataProvider';
import useSelectedOrganization from '@/state/selectedOrganizationState';

export const useCheckUserHasGroup = () => {
  const { user, getAccessTokenWithPopup } = useAuth();
  const redirect = useRedirect();
  const [, setDid] = useSelectedOrganization();
  const {
    data: userData,
    isLoading: isUserDataLoading,
    isError,
  } = useGetOne(dataResources.USERS, {
    id: user.sub,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [hasOrganisations, setHasOrganisations] = useState(false);

  useEffect(() => {
    const checkUserGroup = async () => {
      setIsLoading(true);
      try {
        const userHasGroup = !!userData?.groupId;
        if (userHasGroup) {
          setHasOrganisations(true);
          return;
        }

        setDid('');
        if (!/organizations\/create/.test(window.location.pathname)) {
          redirect('create', 'organizations', undefined, undefined, { userHasGroup });
        }
      } catch (e) {
        if (e.error === 'consent_required') {
          await getAccessTokenWithPopup();
        }
        throw e;
      } finally {
        setIsLoading(false);
      }
    };
    if (!isUserDataLoading && (userData || isError)) {
      checkUserGroup();
    }
  }, [
    getAccessTokenWithPopup,
    redirect,
    setDid,
    setIsLoading,
    userData?.groupId,
    isUserDataLoading,
    userData,
    isError,
  ]);

  return {
    isLoading,
    hasOrganisations,
  };
};
