/**
 * Copyright 2026 Velocity Team
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

const ExitCodes = {
  // validate: the batch is valid. check-rules: every rule reads a value
  OK: 0,
  // validate: the batch has errors. check-rules: a rule reads nothing
  FAILED: 1,
  // The command couldn't run: bad options, an unreadable file, or a Hub or
  // registrar error
  ERROR: 2,
};

module.exports = { ExitCodes };
