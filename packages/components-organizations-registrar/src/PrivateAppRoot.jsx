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
import React, { useEffect, useState } from 'react';
// react admin
import { Admin } from 'react-admin';
import { useLocation } from 'react-router';

import PropTypes from 'prop-types';

import { QueryClient } from '@tanstack/react-query';

// components
import MainLayout from './layouts/MainLayout.jsx';
import Dashboard from './components/Dashboard.jsx';
import Loading from './components/Loading.jsx';
import Footer from './components/Footer.jsx';
import ConsentProvider from './components/ConsentProvider.jsx';
import initReactAdminAuthProvider from './utils/reactAdminAuthProvider.js';
import { useAuth } from './utils/auth/AuthContext.js';
import useSignupRedirect from './utils/auth/useSignupRedirect.js';
import remoteDataProvider from './utils/remoteDataProvider.js';
import { useConfig } from './utils/ConfigContext.js';
import { initTrace } from './utils/tracing.js';
import theme from './theme/theme.js';

const trace = initTrace('PrivateAppRoot');

const AUTH_STATES = Object.freeze({
  SIGNUP_REDIRECT: 'signupRedirect',
  RESOLVING: 'resolving',
  AUTHENTICATED: 'authenticated',
  REFRESHING_AUTHENTICATED: 'refreshingAuthenticated',
  RESOLVING_LOGOUT: 'resolvingLogout',
  LOGGED_OUT: 'loggedOut',
});

const getAuthState = ({
  isSignupProcess,
  isAuthenticated,
  isLoading,
  hasAuthenticatedOnce,
  isLogoutInProgress,
}) => {
  if (isSignupProcess) {
    return AUTH_STATES.SIGNUP_REDIRECT;
  }

  if (isLogoutInProgress) {
    return AUTH_STATES.RESOLVING_LOGOUT;
  }

  if (isAuthenticated) {
    return AUTH_STATES.AUTHENTICATED;
  }

  if (isLoading) {
    return hasAuthenticatedOnce ? AUTH_STATES.REFRESHING_AUTHENTICATED : AUTH_STATES.RESOLVING;
  }

  return AUTH_STATES.LOGGED_OUT;
};

export const PrivateAppRoot = ({ extendedRemoteDataProvider, children }) => {
  const auth = useAuth();
  const { isAuthenticated, isLoading, isLogoutInProgress, login } = auth;
  const config = useConfig();
  const location = useLocation();
  const [hasAuthenticatedOnce, setHasAuthenticatedOnce] = useState(isAuthenticated);
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            refetchOnWindowFocus: false,
          },
        },
      }),
  );
  const { isSignupProcess } = useSignupRedirect({ auth });
  const authState = getAuthState({
    isSignupProcess,
    isAuthenticated,
    isLoading,
    hasAuthenticatedOnce,
    isLogoutInProgress,
  });

  useEffect(() => {
    trace({ event: 'mounted' });
    return () => trace({ event: 'unmounted' });
  }, []);

  useEffect(() => {
    trace({
      event: 'auth-state-changed',
      authState,
    });
  }, [authState]);

  useEffect(() => {
    if (!hasAuthenticatedOnce && isAuthenticated) {
      trace({
        event: 'auth-authenticated-once',
        isAuthenticated,
        isLoading,
      });
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setHasAuthenticatedOnce(true);
    }
  }, [hasAuthenticatedOnce, isAuthenticated, isLoading]);

  useEffect(() => {
    if (authState !== AUTH_STATES.LOGGED_OUT) {
      return;
    }

    const returnTo = localStorage.getItem('afterSignupRedirectUrl') || location.pathname;

    trace({ event: 'login-redirect-requested', returnTo });
    login({ appState: { returnTo } }).then(() => {
      localStorage.removeItem('afterSignupRedirectUrl');
    });
  }, [authState, location.pathname, login]);

  if (![AUTH_STATES.AUTHENTICATED, AUTH_STATES.REFRESHING_AUTHENTICATED].includes(authState)) {
    return <Loading sx={{ pt: '60px' }} />;
  }

  return (
    <ConsentProvider>
      <Admin
        theme={theme}
        authProvider={initReactAdminAuthProvider(auth)}
        dataProvider={remoteDataProvider(config, auth, extendedRemoteDataProvider)}
        queryClient={queryClient}
        dashboard={Dashboard}
        requireAuth
        layout={MainLayout}
        title=""
        basename=""
      >
        {children}
      </Admin>
      <Footer />
    </ConsentProvider>
  );
};

// eslint-disable-next-line better-mutation/no-mutation
PrivateAppRoot.propTypes = {
  children: PropTypes.node.isRequired,
  extendedRemoteDataProvider: PropTypes.func,
};
