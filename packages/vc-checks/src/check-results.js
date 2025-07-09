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

const CheckResults = Object.freeze({
  NOT_CHECKED: 'NOT_CHECKED',
  PASS: 'PASS',
  FAIL: 'FAIL',
  DATA_INTEGRITY_ERROR: 'DATA_INTEGRITY_ERROR',
  NOT_APPLICABLE: 'NOT_APPLICABLE',
  SELF_SIGNED: 'SELF_SIGNED',
  VOUCHER_RESERVE_EXHAUSTED: 'VOUCHER_RESERVE_EXHAUSTED',
  DEPENDENCY_RESOLUTION_ERROR: 'DEPENDENCY_RESOLUTION_ERROR',
});

module.exports = { CheckResults };
