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

// Code snippet inspired by: https://github.com/ldclabs/cose-ts

// IANA-registered COSE common key parameters.
//
// From IANA registry <https://www.iana.org/assignments/cose/cose.xhtml#key-common-parameters>
// as of 2022-12-19.

const KeyParameters = {
  Reserved: 0,
  Kty: 1,
  Kid: 2,
  Alg: 3,
  KeyOps: 4,
  BaseIV: 5,
};

const KeyTypes = {
  Reserved: 0,
  OKP: 1,
  EC2: 2,
  RSA: 3,
  Symmetric: 4,
  HSS_LMS: 5,
  WalnutDSA: 6,
};

const OKPKeyParameters = {
  Crv: -1,
  X: -2,
  D: -4,
};

const EC2KeyParameters = {
  Crv: -1,
  X: -2,
  Y: -3,
  D: -4,
};

const RSAKeyParameters = {
  N: -1,
  E: -2,
  D: -3,
  P: -4,
  Q: -5,
  DP: -6,
  DQ: -7,
  QInv: -8,
  Other: -9,
  RI: -10,
  DI: -11,
  TI: -12,
};

const SymmetricKeyParameters = {
  K: -1,
};

const HSSLMSKeyParameters = {
  Pub: -1,
};

const WalnutDSAKeyParameters = {
  N: -1,
  Q: -2,
  TValues: -3,
  Matrix1: -4,
  Permutation1: -5,
  Matrix2: -6,
};

const Algorithms = {
  RS1: -65535,
  WalnutDSA: -260,
  RS512: -259,
  RS384: -258,
  RS256: -257,
  ES256K: -47,
  HSS_LMS: -46,
  SHAKE256: -45,
  SHA_512: -44,
  SHA_384: -43,
  RSAES_OAEP_SHA_512: -42,
  RSAES_OAEP_SHA_256: -41,
  RSAES_OAEP_RFC_8017_default: -40,
  PS512: -39,
  PS384: -38,
  PS256: -37,
  ES512: -36,
  ES384: -35,
  ECDH_SS_A256KW: -34,
  ECDH_SS_A192KW: -33,
  ECDH_SS_A128KW: -32,
  ECDH_ES_A256KW: -31,
  ECDH_ES_A192KW: -30,
  ECDH_ES_A128KW: -29,
  ECDH_SS_HKDF_512: -28,
  ECDH_SS_HKDF_256: -27,
  ECDH_ES_HKDF_512: -26,
  ECDH_ES_HKDF_256: -25,
  SHAKE128: -18,
  SHA_512_256: -17,
  SHA_256: -16,
  SHA_256_64: -15,
  SHA_1: -14,
  Direct_HKDF_AES_256: -13,
  Direct_HKDF_AES_128: -12,
  Direct_HKDF_SHA_512: -11,
  Direct_HKDF_SHA_256: -10,
  EdDSA: -8,
  ES256: -7,
  Direct: -6,
  A256KW: -5,
  A192KW: -4,
  A128KW: -3,
  Reserved: 0,
  A128GCM: 1,
  A192GCM: 2,
  A256GCM: 3,
  HMAC_256_64: 4,
  HMAC_256_256: 5,
  HMAC_384_384: 6,
  HMAC_512_512: 7,
  AES_CCM_16_64_128: 10,
  AES_CCM_16_64_256: 11,
  AES_CCM_64_64_128: 12,
  AES_CCM_64_64_256: 13,
  AES_MAC_128_64: 14,
  AES_MAC_256_64: 15,
  ChaCha20Poly1305: 24,
  AES_MAC_128_128: 25,
  AES_MAC_256_128: 26,
  AES_CCM_16_128_128: 30,
  AES_CCM_16_128_256: 31,
  AES_CCM_64_128_128: 32,
  AES_CCM_64_128_256: 33,
  IV_GENERATION: 34,
};

const EllipticCurves = {
  Reserved: 0,
  P_256: 1,
  P_384: 2,
  P_521: 3,
  X25519: 4,
  X448: 5,
  Ed25519: 6,
  Ed448: 7,
  Secp256k1: 8,
};

const HeaderParameters = {
  Reserved: 0,
  Alg: 1,
  Crit: 2,
  ContentType: 3,
  Kid: 4,
  IV: 5,
  PartialIV: 6,
  CounterSignature: 7,
  CounterSignature0: 9,
  KidContext: 10,
  CountersignatureV2: 11,
  Countersignature0V2: 11,
  X5Bag: 32,
  X5Chain: 33,
  X5T: 34,
  X5U: 35,
  CuphNonce: 256,
  CuphOwnerPubKey: 257,
};

const HeaderAlgorithmParameters = {
  X5ChainSender: -29,
  X5USender: -28,
  X5TSender: -27,
  PartyVOther: -26,
  PartyVNonce: -25,
  PartyVIdentity: -24,
  PartyUOther: -23,
  PartyUNonce: -22,
  PartyUIdentity: -21,
  Salt: -20,
  StaticKeyId: -3,
  StaticKey: -2,
  EphemeralKey: -1,
};

const KeyOperations = {
  Sign: 1,
  Verify: 2,
  Encrypt: 3,
  Decrypt: 4,
  WrapKey: 5,
  UnwrapKey: 6,
  DeriveKey: 7,
  DeriveBits: 8,
  MacCreate: 9,
  MacVerify: 10,
};

const CBORTags = {
  COSEEncrypt0: 16,
  COSEMac0: 17,
  COSESign1: 18,
  CWT: 61,
  COSEEncrypt: 96,
  COSEMac: 97,
  COSESign: 98,
};

const CWTClaims = {
  Reserved: 0,
  Iss: 1,
  Sub: 2,
  Aud: 3,
  Exp: 4,
  Nbf: 5,
  Iat: 6,
  Cti: 7,
  Cnf: 8,
  Scope: 9,
  Nonce: 10,
};

module.exports = {
  KeyParameters,
  KeyTypes,
  OKPKeyParameters,
  EC2KeyParameters,
  RSAKeyParameters,
  SymmetricKeyParameters,
  HSSLMSKeyParameters,
  WalnutDSAKeyParameters,
  Algorithms,
  EllipticCurves,
  HeaderParameters,
  HeaderAlgorithmParameters,
  KeyOperations,
  CBORTags,
  CWTClaims,
};
