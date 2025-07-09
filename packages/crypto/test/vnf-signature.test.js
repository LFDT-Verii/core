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

const crypto = require('crypto');
const canonicalize = require('canonicalize');
const {
  buildVnfSignature,
  verifyVnfSignature,
} = require('../src/vnf-signature');
const {
  publicKeyHexToPem,
  signAndEncodeBase64,
  generateKeyPair,
} = require('../src/crypto');

describe('vnf signature library', () => {
  const { privateKey, publicKey } = generateKeyPair();
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('build vnf signatures', () => {
    it('should be able to create verifiable proofs', () => {
      jest.spyOn(Date, 'now').mockImplementation(() => 1234567890);
      const context = {
        config: {
          vnfHeaderSignatureSigningKey: privateKey,
        },
      };
      const payload = { body: 1 };
      const result = buildVnfSignature(payload, context);
      expect(result).toEqual({
        timestamp: 1234567890,
        vnfSignature: expect.any(String),
        headerValue: expect.stringMatching(
          new RegExp('t=1234567890,v1=[A-Za-z0-9/+=]+')
        ),
      });
      const [timestamp, vnfSignature] = result.headerValue.split(',');
      const [, timestampValue] = timestamp.split('=');
      const [, vnfSignatureValue] = vnfSignature.split('=');
      const isSignatureValid = crypto
        .createVerify('SHA256')
        .update(`${timestampValue}.${canonicalize(payload)}`)
        .verify(
          publicKeyHexToPem(publicKey),
          Buffer.from(vnfSignatureValue, 'base64')
        );
      expect(isSignatureValid).toBe(true);
    });
  });

  describe('verify vnf signatures', () => {
    const body = { prop: 'hello', x: 1 };
    const config = {
      vnfHeaderSignatureVerificationKey: publicKey,
    };
    let currentTimestamp;
    let signature;
    let proof;

    beforeEach(() => {
      jest.spyOn(Date, 'now').mockImplementation(() => 1234567890);
      currentTimestamp = Date.now();
      signature = signAndEncodeBase64(
        `${currentTimestamp}.${canonicalize(body)}`,
        privateKey
      );
      proof = `t=${currentTimestamp},v1=${signature}`;
    });

    it('should fail to verify if no proof passed', () => {
      expect(verifyVnfSignature(body, null, { config })).toEqual(false);
    });

    it('should verify valid proof', () => {
      expect(verifyVnfSignature(body, proof, { config })).toEqual(true);
    });

    it('should fail to verify if the body has been tampered', () => {
      expect(verifyVnfSignature({ ...body, x: 2 }, proof, { config })).toEqual(
        false
      );
    });

    it('should fail to verify if the proof format is incorrect', () => {
      expect(
        verifyVnfSignature(
          body,
          `noTimestamp=${currentTimestamp},v1=${signature}`,
          { config }
        )
      ).toEqual(false);
      expect(
        verifyVnfSignature(body, `t=${currentTimestamp},noSig=${signature}`, {
          config,
        })
      ).toEqual(false);
      expect(
        verifyVnfSignature(
          body,
          `prefix=0,t=${currentTimestamp},v1=${signature}`,
          {
            config,
          }
        )
      ).toEqual(false);
    });

    it('should fail to verify if the key changes', () => {
      expect(
        verifyVnfSignature(body, proof, {
          publicKey: generateKeyPair().publicKey,
        })
      ).toEqual(false);
    });
  });
});
