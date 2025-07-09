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

const canonicalize = require('canonicalize');
const { split, last } = require('lodash/fp');
const { signAndEncodeBase64, verifyBase64Signature } = require('./crypto');

const VNF_SIGNATURE_HTTP_HEADER_NAME = 'x-vnf-signature';

const buildTimestampedPayload = (timestamp, payload) =>
  `${timestamp}.${canonicalize(payload)}`;

const buildVnfSignature = (payload, { config }) => {
  const timestamp = Date.now();
  const vnfSignature = signAndEncodeBase64(
    buildTimestampedPayload(timestamp, payload),
    config.vnfHeaderSignatureSigningKey
  );
  return {
    headerValue: `t=${timestamp},v1=${vnfSignature}`,
    timestamp,
    vnfSignature,
  };
};

const verifyVnfSignature = (payload, headerValue, { config }) => {
  try {
    if (!headerValue) {
      return false;
    }
    const [timestampPortion, vnfSignaturePortion] = split(',', headerValue);
    const timestamp = last(split(/(t=)/, timestampPortion));
    const vnfSignature = last(split(/(v1=)/, vnfSignaturePortion));
    return verifyBase64Signature(
      buildTimestampedPayload(timestamp, payload),
      vnfSignature,
      config.vnfHeaderSignatureVerificationKey
    );
  } catch {
    return false;
  }
};

module.exports = {
  VNF_SIGNATURE_HTTP_HEADER_NAME,
  buildVnfSignature,
  verifyVnfSignature,
};
