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
import { fetchUtils } from 'react-admin';

const httpClient =
  (config, auth) =>
  async (url, options = {}) => {
    if (!options.headers) {
      // eslint-disable-next-line better-mutation/no-mutation
      options.headers = new Headers({ Accept: 'application/json' });
    }

    if (auth) {
      const token = await auth.getAccessToken();
      if (token) {
        options.headers.set('Authorization', `Bearer ${token}`);
      }
    }

    if (config?.xAutoActivate) {
      options.headers.set('x-auto-activate', '1');
    }

    return fetchUtils.fetchJson(url, options);
  };

export default httpClient;
