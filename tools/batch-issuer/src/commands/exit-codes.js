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
  // validate: the batch is valid. load: the batch is loaded. check-rules:
  // every rule reads a value
  OK: 0,
  // validate and load: the batch has errors, and nothing was written.
  // check-rules: a rule reads nothing
  FAILED: 1,
  // The command couldn't run: bad options, an unreadable file, a state file
  // of another batch, or a Hub or registrar error. load: a write failed, and
  // the state file records what was written before it
  ERROR: 2,
};

module.exports = { ExitCodes };
