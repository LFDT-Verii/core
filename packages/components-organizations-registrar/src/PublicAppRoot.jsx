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

// eslint-disable-next-line import/no-extraneous-dependencies
import { QueryClient } from '@tanstack/react-query';
import { Admin, CustomRoutes } from 'react-admin';
import PropTypes from 'prop-types';
import React from 'react';
import Dashboard from './components/Dashboard.jsx';
import MainLayout from './layouts/MainLayout.jsx';
import Footer from './components/Footer.jsx';
import theme from './theme/theme';
import remoteDataProvider from './utils/remoteDataProvider';
import { useConfig } from './utils/ConfigContext';

export const PublicAppRoot = ({ children }) => {
  const config = useConfig();
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        refetchOnWindowFocus: false,
      },
    },
  });
  return (
    <>
      <Admin
        theme={theme}
        dataProvider={remoteDataProvider(config)}
        queryClient={queryClient}
        dashboard={Dashboard}
        layout={MainLayout}
        title=""
        basename=""
      >
        <CustomRoutes noLayout>{children}</CustomRoutes>
      </Admin>
      <Footer />
    </>
  );
};

// eslint-disable-next-line better-mutation/no-mutation
PublicAppRoot.propTypes = {
  children: PropTypes.node.isRequired,
};
