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

module.exports = {
  AUTH0_USER_ID_FORMAT: /auth0|[A-Za-z0-9_-]+/,
  BASE64_FORMAT: /^[A-Za-z0-9/+=]+$/,
  DID_FORMAT: /^did:[a-z]+:[a-zA-Z0-9._:?=&%;\-#]+$/,
  ETHEREUM_ADDRESS_FORMAT: /^0x[a-fA-F0-9]{40}$/,
  HEX_FORMAT: /^[a-f0-9]+$/,
  ISO_DATETIME_FORMAT: /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
  ISO_DATETIME_FORMAT_ONLY_DATE_SECTION: /^\d{4}-\d{2}-\d{2}/,
  JWT_FORMAT: /^[A-Za-z0-9-_=]+\.[A-Za-z0-9-_=]+\.?[A-Za-z0-9-_.+/=]*$/,
  NANO_ID_FORMAT: /^([A-Za-z0-9_-]+)/,
  NUMERIC_FORMAT: /^[0-9]+$/,
  OBJECT_ID_FORMAT: /^[0-9a-fA-F]{24}$/,
  REQUEST_ID: /^([A-Za-z0-9_-]+)/,
  TW0_DECIMAL_POINT_NUMBER: /^[0-9]*\.[0-9]{2}$/,
  TW0_OR_THREE_DECIMAL_POINT_NUMBER: /^[0-9]*\.[0-9]{2,3}$/,
  UUID_FORMAT:
    /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/,
  URLSAFE_BASE64_FORMAT: /^[A-Za-z0-9-_=]+$/,
};
