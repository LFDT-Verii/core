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

import { useEffect } from 'react';
import { useRedirect } from 'react-admin';
import useSelectedOrganization from '../state/selectedOrganizationState';
import Loading from './Loading.jsx';

const Dashboard = () => {
  const redirect = useRedirect();
  const [did] = useSelectedOrganization();

  useEffect(() => {
    if (!did) {
      return;
    }
    redirect('show', 'organizations', did);
  }, [did, redirect]);

  return <Loading sx={{ pt: '60px' }} />;
};

export default Dashboard;
