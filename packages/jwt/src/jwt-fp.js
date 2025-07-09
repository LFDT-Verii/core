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

const { curry } = require('lodash/fp');

const setProtectedHeader = curry((options, wrapper) =>
  wrapper.setProtectedHeader(options)
);

const setIssuedAt = curry((iat, wrapper) => wrapper.setIssuedAt(iat));

const setOptionalIssuer = curry((issuer, wrapper) =>
  issuer != null ? wrapper.setIssuer(issuer) : wrapper
);

const setOptionalAudience = curry((audience, wrapper) =>
  audience != null ? wrapper.setAudience(audience) : wrapper
);

const setOptionalNotBefore = curry((nbf, wrapper) =>
  nbf != null ? wrapper.setNotBefore(nbf) : wrapper
);

const setOptionalJti = curry((jti, wrapper) =>
  jti != null ? wrapper.setJti(jti) : wrapper
);

const setOptionalExpirationTime = curry((exp, wrapper) =>
  exp != null ? wrapper.setExpirationTime(exp) : wrapper
);

const setOptionalSubject = curry((subject, wrapper) =>
  subject != null ? wrapper.setSubject(subject) : wrapper
);

module.exports = {
  setIssuedAt,
  setProtectedHeader,
  setOptionalAudience,
  setOptionalExpirationTime,
  setOptionalIssuer,
  setOptionalJti,
  setOptionalNotBefore,
  setOptionalSubject,
};
