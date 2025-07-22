/*
 * Copyright 2025 Velocity Team
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
 *
 */
import React, { useMemo } from 'react';
import {
  AuthContext,
  registrarApiScopes,
} from '@verii/components-organizations-registrar';
import { useAuth0 } from '@auth0/auth0-react';

/* eslint-disable react/prop-types */
export const AuthProviderBridge = ({ config: { authConfig }, children }) => {
  const {
    user,
    isAuthenticated,
    isLoading,
    loginWithRedirect,
    logout,
    getAccessTokenSilently,
    getAccessTokenWithPopup,
  } = useAuth0();

  const auth = useMemo(() => {
    const defaultAccessTokenOptions = {
      audience: authConfig.audience,
      scope: registrarApiScopes,
    };

    return {
      user,
      isLoading,
      isAuthenticated,
      login: (...args) => loginWithRedirect(...args),
      logout: () =>
        logout({
          clientId: authConfig.clientId,
          logoutParams: {
            federated: true,
            returnTo: window.location.origin,
          },
        }),
      getAccessToken: (options = defaultAccessTokenOptions) => {
        try {
          return getAccessTokenSilently(options);
        } catch (e) {
          console.error(e);
          return null;
        }
      },
      getAccessTokenWithPopup: (options = defaultAccessTokenOptions) => {
        try {
          return getAccessTokenWithPopup(options);
        } catch (e) {
          console.error(e);
          return null;
        }
      },
    };
  }, [
    user,
    isLoading,
    isAuthenticated,
    loginWithRedirect,
    logout,
    getAccessTokenSilently,
    getAccessTokenWithPopup,
    authConfig,
  ]);
  /* eslint-enable */

  return <AuthContext.Provider value={auth}>{children}</AuthContext.Provider>;
};
