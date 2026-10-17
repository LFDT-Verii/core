/*
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
 *
 */

const { isPlainObject, isString } = require('lodash/fp');

const CENSOR = '...shhh...';
const SECRET_NAME = /(?:key|passphrase|password|secret|token)s?$/i;
const PUBLIC_KEY_NAME = /(?:public|verification)[-_]?keys?$/i;

/**
 * Returns a copy of the config that is safe to log. Values of settings whose
 * names end in Key, Passphrase, Password, Secret or Token (except public and
 * verification keys) and URLs containing a password are censored. The config
 * itself is not modified.
 * @param {object} config server config
 * @returns {object} the config with secret values censored
 */
const redactConfigSecrets = (config) => redactValue(config, []);

const redactValue = (value, ancestors) => {
  if (ancestors.includes(value)) {
    return '[Circular]';
  }
  if (Array.isArray(value)) {
    return value.map((item) => redactValue(item, [...ancestors, value]));
  }
  if (isPlainObject(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([name, item]) => [
        name,
        redactEntry(name, item, [...ancestors, value]),
      ]),
    );
  }
  return hasUrlPassword(value) ? CENSOR : value;
};

const redactEntry = (name, value, ancestors) =>
  value !== undefined && isSecretName(name)
    ? CENSOR
    : redactValue(value, ancestors);

const isSecretName = (name) =>
  SECRET_NAME.test(name) && !PUBLIC_KEY_NAME.test(name);

const hasUrlPassword = (value) =>
  isString(value) && URL.canParse(value) && new URL(value).password !== '';

module.exports = { redactConfigSecrets };
