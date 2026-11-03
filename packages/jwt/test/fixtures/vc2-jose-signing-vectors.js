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

const { KeyAlgorithms } = require('@verii/crypto');

const ES256_PRIVATE_JWK = Object.freeze({
  crv: 'P-256',
  d: 'mbB2gnCGvxz4i8JUGRBlvne0xcwbcKxQVkh1nr3MUac',
  kty: 'EC',
  x: 'GvSUQOt5HP5s2VSZN_TqWkis_s_Bh2oYp545vmZGxjg',
  y: 'OhUXfhB5ctU2Wi4fHOrV01MIdekaiMycdBAsN9MbIWc',
});

const ES256_PUBLIC_JWK = Object.freeze({
  crv: 'P-256',
  kty: 'EC',
  x: 'GvSUQOt5HP5s2VSZN_TqWkis_s_Bh2oYp545vmZGxjg',
  y: 'OhUXfhB5ctU2Wi4fHOrV01MIdekaiMycdBAsN9MbIWc',
});

/* eslint-disable max-len -- fixed JWK parameters must remain byte-exact */
const RS256_PRIVATE_JWK = Object.freeze({
  d: 'A5US_Ey0O4EeV7J7ROvfgGYnReZooz2OEY4k8QKKh4vsJLrGdCJ1CWDK_XOI1npQcD6QcrSH_cfekJKrHvmOQ8u7WwaDFdzAZqxL4zPVZtsSnP67Ia85wfUUDYwB9wBdKsfW3gsMMp3GJjDlXe9TvKcJ7nxnRDR0d-6qsxhuSeJLSynR3DJz7syrlsZKEz4UDfQVtr_-7T2QkdI0OZeaVsD0bJWwxYZUz5DG4j-yvOJPVGsbkLb5MHZWD50HvQWUWnsswRerz-WT8D2pa7zTojzm42XMWHT9z5XJ8hrTPetztRC-PIKiCVYaNg4PQ4boF9qf_iaZynbzagSbwTHh9Q',
  dp: 'HSlG9jbsMP7ml5G_XsiNih7EOo3ckTSeezpzwtKorxCPVGzhBeMJlzl7GLqTT17QsAip8oLvGrl2FdiL5vPncG3gZeWW_fVlreEx_f5_qJLLd5PuSmrMi5t8QeqqhdAHqtYC3__JvOT3U1ueC9fvCNHZ4fDUBFcLy0pDMwCzuuU',
  dq: 'PRpI7jCfJRFrfEi-0WCDkEf4NZXo4DpLZFalsZtWGe1c9i0gzOQfZE4SSRXeXV9NvNg-UtxIMRydJ9kBzVXVl9IQLOO67tbys6qn2sOiqMWOPoqhbOQT56t1XBP3Gt9rbBltUBeDehSfOMhxnBrZkOTCboHNRw32wU1ILp97HWk',
  e: 'AQAB',
  kty: 'RSA',
  n: 'ok4l8IxC71ZtVyGIFGC0kQ_IFYj9BIwLhewW24oM71sANDHDdQ5G8HvzTP18JyOlfFQCs86RtXecQx3ES4NFtBNRR2M3X0Y4AB-Z-LHLNI7nrWlp0YSMBc-vwyFGLHraauV6ts3efdO2uXtdU5GBz3fUYQsxwA-xfWnbUsK-qXpqm9Lt648NUBlbx_AAEWoFOrYAm2MJf-bQBmDm7sModr-0EWnBjR8hBPW_dHlapytCzMs1La6Z0YPt8BjJkeMJBhmJ3_qRQjSmyqKIYU9MWli8pu9ZqOyN5u_CZUdatWUARJflAQD6E7TpVJJB6l0jrYgIJzPdArqchzN8cQf-sw',
  p: '25h2WgHG35ZUJCG8xckA0GLJTBmBqfdXvaq5paYm0eJcc4x_-njDYhJ7bp7m2TSB-ygmr6JjxCCdpREkQQ-DaEGtzrMqFGzxaxFDTrMv1MXoAhmlaV4gmptd56vit3L377HOWPiM3BrVRPKKLS5azBu6zzifduXamATlte4E_R0',
  q: 'vTZPvh6kq93xv1A1u2IiXL8fd-vahzkvcr5FSf3eGRrW9vo63ANwTfbjAfxQ7_ToxwcN07Yz7tVaSkuxTrdpNPnzsqH81nX6nNRBSYmfF3gHZ2hEaMUHi3vHYpMHfEfgyVYXoTnD7SGkhdOD_5HyTeDIvI4yt4Ly-c6qjXiLsg8',
  qi: 'FSkdIQt9iYAKxZPNakJ2W2Au9CfrsQprUoXem1zRDuac9SDm8TJSA_BSO3sVXEv9cwVqlcUpiUq86PHG2IQsEemZZDtrXxni__46vug1zRWixLzpjB5nmdnXGIXijBi04p1ZMMbrD3Nq-jtlQoKIM1M2UyIo7-TrGDrjfvY_ZBk',
});

const RS256_PUBLIC_JWK = Object.freeze({
  e: 'AQAB',
  kty: 'RSA',
  n: 'ok4l8IxC71ZtVyGIFGC0kQ_IFYj9BIwLhewW24oM71sANDHDdQ5G8HvzTP18JyOlfFQCs86RtXecQx3ES4NFtBNRR2M3X0Y4AB-Z-LHLNI7nrWlp0YSMBc-vwyFGLHraauV6ts3efdO2uXtdU5GBz3fUYQsxwA-xfWnbUsK-qXpqm9Lt648NUBlbx_AAEWoFOrYAm2MJf-bQBmDm7sModr-0EWnBjR8hBPW_dHlapytCzMs1La6Z0YPt8BjJkeMJBhmJ3_qRQjSmyqKIYU9MWli8pu9ZqOyN5u_CZUdatWUARJflAQD6E7TpVJJB6l0jrYgIJzPdArqchzN8cQf-sw',
});
/* eslint-enable max-len */

const SECP256K1_PRIVATE_JWK = Object.freeze({
  crv: 'secp256k1',
  d: 'rZnAWkOmZOUXKE18EZ6Zkv4KX0gbPKAyhx6rWuVC2O8',
  kty: 'EC',
  x: '0J6wMpT3nslho8i5kYriFR23qtFtM9l2Z7t4f_vUTy8',
  y: '77copy_DAKW5pKhBfy6Y73IHV4kC0PDEFz3JZL7GR7I',
});

const SECP256K1_PUBLIC_JWK = Object.freeze({
  crv: 'secp256k1',
  kty: 'EC',
  x: '0J6wMpT3nslho8i5kYriFR23qtFtM9l2Z7t4f_vUTy8',
  y: '77copy_DAKW5pKhBfy6Y73IHV4kC0PDEFz3JZL7GR7I',
});

const vc2JoseSigningVectors = Object.freeze([
  Object.freeze({
    joseAlgorithm: 'ES256K',
    keyAlgorithm: KeyAlgorithms.SECP256K1,
    privateKey: SECP256K1_PRIVATE_JWK,
    publicKey: SECP256K1_PUBLIC_JWK,
  }),
  Object.freeze({
    joseAlgorithm: 'ES256',
    keyAlgorithm: KeyAlgorithms.ES256,
    privateKey: ES256_PRIVATE_JWK,
    publicKey: ES256_PUBLIC_JWK,
  }),
  Object.freeze({
    joseAlgorithm: 'RS256',
    keyAlgorithm: KeyAlgorithms.RS256,
    privateKey: RS256_PRIVATE_JWK,
    publicKey: RS256_PUBLIC_JWK,
  }),
]);

module.exports = { vc2JoseSigningVectors };
