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

import { Route, useLocation, useNavigate } from 'react-router-dom';
import { CustomRoutes, Resource } from 'react-admin';
import React from 'react';
import { Auth0Provider } from '@auth0/auth0-react';
import OrganizationIcon from '@mui/icons-material/Business';
import {
  OrganizationShow,
  OrganizationEdit,
  OrganizationCreate,
} from '@verii/components-organizations-registrar/pages/organizations';
import {
  IndividualsDashboard,
  IndividualsShow,
  IndividualsEdit,
} from '@verii/components-organizations-registrar/pages/individuals';
import { ServicesList } from '@verii/components-organizations-registrar/pages/services';
import {
  CreateOrganisationFromInvitation,
  InvitationsList,
} from '@verii/components-organizations-registrar/pages/invitations';
import {
  PrivacyPolicy,
  TermsAndConditions,
  SignatoryLanding,
} from '@verii/components-organizations-registrar/pages';
import { Dashboard } from '@verii/components-organizations-registrar/components';
import {
  defaultOAuthScopes,
  registrarApiScopes,
  PublicAppRoot,
  PrivateAppRoot,
  useConfig,
} from '@verii/components-organizations-registrar';
import { AuthProviderBridge } from './AuthProviderBridge.jsx';

const PublicRoutes = ['/privacy-policy', '/terms-and-conditions', /^\/signatories\/[^/]+$/];

const isPublicRoute = (pathname) =>
  PublicRoutes.some((route) =>
    typeof route === 'string' ? route === pathname : route.test(pathname),
  );

const App = () => {
  const location = useLocation();
  if (isPublicRoute(location.pathname)) {
    return (
      <PublicAppRoot>
        <Route path="/privacy-policy" element={<PrivacyPolicy />} />
        <Route path="/terms-and-conditions" element={<TermsAndConditions />} />
        <Route path="/signatories/:response" element={<SignatoryLanding />} />
      </PublicAppRoot>
    );
  }

  return <PrivateRegistrarApp />;
};

const PrivateRegistrarApp = () => {
  const config = useConfig();
  const navigate = useNavigate();
  const onRedirectCallback = (appState) => {
    navigate(appState?.returnTo || window.location.pathname);
  };

  return (
    <Auth0Provider
      domain={config.authConfig.domain}
      clientId={config.authConfig.clientId}
      useRefreshTokens
      cacheLocation="localstorage"
      onRedirectCallback={onRedirectCallback}
      authorizationParams={{
        audience: config.authConfig.audience,
        scope: `${registrarApiScopes} ${defaultOAuthScopes}`,
        redirect_uri: config.authConfig.redirectUri,
        connection: config.authConfig.connection,
      }}
    >
      <AuthProviderBridge config={config}>
        <PrivateAppRoot>
          <Resource
            name="organizations"
            icon={OrganizationIcon}
            show={OrganizationShow}
            list={Dashboard}
            edit={OrganizationEdit}
            create={OrganizationCreate}
          />
          <Resource
            name="individuals"
            list={IndividualsDashboard}
            show={IndividualsShow}
            edit={IndividualsEdit}
          />
          <Resource name="services" list={ServicesList} create={ServicesList} />
          <Resource name="users" />
          <Resource name="invitations" list={InvitationsList} create={InvitationsList} />
          <CustomRoutes noLayout>
            <Route exact path="/invitations/:code" element={<CreateOrganisationFromInvitation />} />
          </CustomRoutes>
        </PrivateAppRoot>
      </AuthProviderBridge>
    </Auth0Provider>
  );
};

export default App;
