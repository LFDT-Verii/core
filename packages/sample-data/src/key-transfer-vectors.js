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

// secp256k1 test keys whose private scalar (d), x or y coordinate starts with a
// 0x00 byte. Hex and JWK encodings of these keys must keep the full 32 bytes:
// 64 hex characters for the private key, 130 for the uncompressed public key
// and 43 base64url characters for each JWK member.
const leadingZeroSecp256k1Keys = {
  d: {
    privateKeyHex:
      '002e86fe364aa15a522fc82892df9d95ed2a059e40a12a709a96e5975f058412',
    publicKeyHex:
      '04a09db2d97492db69aec3769891540ed15257a3108cfe1fe1775d5dc1443bf2a9e2cba9eb1b74a383040e0248319b7a81fec002ca57cc6b7e50e55e06e7b95114',
    privateJwk: {
      kty: 'EC',
      x: 'oJ2y2XSS22muw3aYkVQO0VJXoxCM_h_hd11dwUQ78qk',
      y: '4sup6xt0o4MEDgJIMZt6gf7AAspXzGt-UOVeBue5URQ',
      crv: 'secp256k1',
      d: 'AC6G_jZKoVpSL8gokt-dle0qBZ5AoSpwmpbll18FhBI',
    },
    publicJwk: {
      kty: 'EC',
      x: 'oJ2y2XSS22muw3aYkVQO0VJXoxCM_h_hd11dwUQ78qk',
      y: '4sup6xt0o4MEDgJIMZt6gf7AAspXzGt-UOVeBue5URQ',
      crv: 'secp256k1',
    },
  },
  x: {
    privateKeyHex:
      'c8a46d3b27408801e22d739b9df5acd7a7299a4b71b2065399337e34768b29e5',
    publicKeyHex:
      '0400ece7752bba3cba3f2b6ce814d40907611ee678f5a895efbdfb0fddf739b84a46f2a6cfb6bd8c5992286d77434a515abd14fa932c16a132acd6a521aaf3237e',
    privateJwk: {
      kty: 'EC',
      x: 'AOzndSu6PLo_K2zoFNQJB2Ee5nj1qJXvvfsP3fc5uEo',
      y: 'RvKmz7a9jFmSKG13Q0pRWr0U-pMsFqEyrNalIarzI34',
      crv: 'secp256k1',
      d: 'yKRtOydAiAHiLXObnfWs16cpmktxsgZTmTN-NHaLKeU',
    },
    publicJwk: {
      kty: 'EC',
      x: 'AOzndSu6PLo_K2zoFNQJB2Ee5nj1qJXvvfsP3fc5uEo',
      y: 'RvKmz7a9jFmSKG13Q0pRWr0U-pMsFqEyrNalIarzI34',
      crv: 'secp256k1',
    },
  },
  y: {
    privateKeyHex:
      '2a46bf93ff953ae522c1b4e8e87ca1f71a953755372f0dbbb7e358488f300242',
    publicKeyHex:
      '048cda21fe7edbe65244048c312ec9baa077d8429e256553e79a2bf170b3bb473100d29077081145508e8b3a55b6682feb9f0d6a9e6be2af1a005b6b0d75918939',
    privateJwk: {
      kty: 'EC',
      x: 'jNoh_n7b5lJEBIwxLsm6oHfYQp4lZVPnmivxcLO7RzE',
      y: 'ANKQdwgRRVCOizpVtmgv658Nap5r4q8aAFtrDXWRiTk',
      crv: 'secp256k1',
      d: 'Kka_k_-VOuUiwbTo6Hyh9xqVN1U3Lw27t-NYSI8wAkI',
    },
    publicJwk: {
      kty: 'EC',
      x: 'jNoh_n7b5lJEBIwxLsm6oHfYQp4lZVPnmivxcLO7RzE',
      y: 'ANKQdwgRRVCOizpVtmgv658Nap5r4q8aAFtrDXWRiTk',
      crv: 'secp256k1',
    },
  },
};

module.exports = { leadingZeroSecp256k1Keys };
