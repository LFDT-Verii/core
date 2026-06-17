/*
 * Copyright 2024 Velocity Team
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

const KeyErrors = {
  KEY_PURPOSES_NOT_UNIQUE: 'key_purposes_not_unique',
  KEY_KID_FRAGMENT_NOT_FOUND: 'key_kidFragment_not_found',
  KEY_KID_FRAGMENT_NOT_UNIQUE: 'key_kidFragment_not_unique',
  DLT_TRANSACTION_KEY_REQUIRED: 'dlt_transaction_key_required',
  EXCHANGES_KEY_REQUIRED: 'exchanges_key_required',
};
module.exports = { KeyErrors };
