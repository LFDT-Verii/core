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

export default {
  authConfig: {
    domain: import.meta.env.VITE_REGISTRAR_AUTH0_DOMAIN,
    clientId: import.meta.env.VITE_REGISTRAR_AUTH0_CLIENT_ID,
    redirectUri: import.meta.env.VITE_REGISTRAR_AUTH0_REDIRECT_URI,
    audience: import.meta.env.VITE_REGISTRAR_AUDIENCE,
    connection: import.meta.env.VITE_REGISTRAR_CONNECTION,
  },
  registrarApi: import.meta.env.VITE_REGISTRAR_API,
  xAutoActivate: import.meta.env.VITE_X_AUTO_ACTIVATE === 'true',
  chainName: import.meta.env.VITE_CHAIN_NAME || 'Devnet',
};
