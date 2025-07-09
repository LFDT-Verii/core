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

const initReactAdminAuthProvider = (auth) => ({
  // called when the user attempts to log in. Never called
  login: async () => {},
  // called when the user clicks on the logout button
  logout: (...args) => {
    // eslint-disable-next-line no-undef
    localStorage.removeItem('RaStore.selectedOrganization');
    // eslint-disable-next-line no-undef
    localStorage.removeItem('RaStore.agreedTermsAndConditionVersion');
    return auth.logout(...args);
  },
  // called when the API returns an error
  checkError: async ({ status }) => {
    if (status === 401 || status === 403) {
      throw new Error(`Auth Error ${status}`);
    }
  },
  // called when the user navigates to a new location, to check for authentication. Ignore calls
  checkAuth: async () => {},
  // called when the user navigates to a new location, to check for permissions / roles.  Ignore calls
  getPermissions: async () => {},
  // called when getting the user details. Ignore calls
  getIdentity: () => {
    return { id: auth.user.sub, fullName: auth.user.name, avatar: auth.user.picture };
  },
});

export default initReactAdminAuthProvider;
