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

const { createPrivateKey, createPublicKey } = require('node:crypto');
const { KeyAlgorithms } = require('@verii/crypto');

const ES256_PEM = `-----BEGIN PRIVATE KEY-----
MIGHAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBG0wawIBAQQgmbB2gnCGvxz4i8JU
GRBlvne0xcwbcKxQVkh1nr3MUaehRANCAAQa9JRA63kc/mzZVJk39OpaSKz+z8GH
ahinnjm+ZkbGODoVF34QeXLVNlouHxzq1dNTCHXpGojMnHQQLDfTGyFn
-----END PRIVATE KEY-----`;

const RS256_PEM = `-----BEGIN PRIVATE KEY-----
MIIEvAIBADANBgkqhkiG9w0BAQEFAASCBKYwggSiAgEAAoIBAQCiTiXwjELvVm1X
IYgUYLSRD8gViP0EjAuF7BbbigzvWwA0McN1Dkbwe/NM/XwnI6V8VAKzzpG1d5xD
HcRLg0W0E1FHYzdfRjgAH5n4scs0juetaWnRhIwFz6/DIUYsetpq5Xq2zd5907a5
e11TkYHPd9RhCzHAD7F9adtSwr6pemqb0u3rjw1QGVvH8AARagU6tgCbYwl/5tAG
YObuwyh2v7QRacGNHyEE9b90eVqnK0LMyzUtrpnRg+3wGMmR4wkGGYnf+pFCNKbK
oohhT0xaWLym71mo7I3m78JlR1q1ZQBEl+UBAPoTtOlUkkHqXSOtiAgnM90CupyH
M3xxB/6zAgMBAAECggEAA5US/Ey0O4EeV7J7ROvfgGYnReZooz2OEY4k8QKKh4vs
JLrGdCJ1CWDK/XOI1npQcD6QcrSH/cfekJKrHvmOQ8u7WwaDFdzAZqxL4zPVZtsS
nP67Ia85wfUUDYwB9wBdKsfW3gsMMp3GJjDlXe9TvKcJ7nxnRDR0d+6qsxhuSeJL
SynR3DJz7syrlsZKEz4UDfQVtr/+7T2QkdI0OZeaVsD0bJWwxYZUz5DG4j+yvOJP
VGsbkLb5MHZWD50HvQWUWnsswRerz+WT8D2pa7zTojzm42XMWHT9z5XJ8hrTPetz
tRC+PIKiCVYaNg4PQ4boF9qf/iaZynbzagSbwTHh9QKBgQDbmHZaAcbfllQkIbzF
yQDQYslMGYGp91e9qrmlpibR4lxzjH/6eMNiEntunubZNIH7KCavomPEIJ2lESRB
D4NoQa3OsyoUbPFrEUNOsy/UxegCGaVpXiCam13nq+K3cvfvsc5Y+IzcGtVE8oot
LlrMG7rPOJ925dqYBOW17gT9HQKBgQC9Nk++HqSr3fG/UDW7YiJcvx9369qHOS9y
vkVJ/d4ZGtb2+jrcA3BN9uMB/FDv9OjHBw3TtjPu1VpKS7FOt2k0+fOyofzWdfqc
1EFJiZ8XeAdnaERoxQeLe8dikwd8R+DJVhehOcPtIaSF04P/kfJN4Mi8jjK3gvL5
zqqNeIuyDwKBgB0pRvY27DD+5peRv17IjYoexDqN3JE0nns6c8LSqK8Qj1Rs4QXj
CZc5exi6k09e0LAIqfKC7xq5dhXYi+bz53Bt4GXllv31Za3hMf3+f6iSy3eT7kpq
zIubfEHqqoXQB6rWAt//ybzk91NbngvX7wjR2eHw1ARXC8tKQzMAs7rlAoGAPRpI
7jCfJRFrfEi+0WCDkEf4NZXo4DpLZFalsZtWGe1c9i0gzOQfZE4SSRXeXV9NvNg+
UtxIMRydJ9kBzVXVl9IQLOO67tbys6qn2sOiqMWOPoqhbOQT56t1XBP3Gt9rbBlt
UBeDehSfOMhxnBrZkOTCboHNRw32wU1ILp97HWkCgYAVKR0hC32JgArFk81qQnZb
YC70J+uxCmtShd6bXNEO5pz1IObxMlID8FI7exVcS/1zBWqVxSmJSrzo8cbYhCwR
6ZlkO2tfGeL//jq+6DXNFaLEvOmMHmeZ2dcYheKMGLTinVkwxusPc2r6O2VCgogz
UzZTIijv5OsYOuN+9j9kGQ==
-----END PRIVATE KEY-----`;

const SECP256K1_PEM = `-----BEGIN PRIVATE KEY-----
MIGEAgEAMBAGByqGSM49AgEGBSuBBAAKBG0wawIBAQQgrZnAWkOmZOUXKE18EZ6Z
kv4KX0gbPKAyhx6rWuVC2O+hRANCAATQnrAylPeeyWGjyLmRiuIVHbeq0W0z2XZn
u3h/+9RPL++3KKcvwwCluaSoQX8umO9yB1eJAtDwxBc9yWS+xkey
-----END PRIVATE KEY-----`;

const buildSigningVector = (keyAlgorithm, joseAlgorithm, pem) => {
  const privateKey = createPrivateKey(pem);
  return Object.freeze({
    joseAlgorithm,
    keyAlgorithm,
    privateKey: Object.freeze(privateKey.export({ format: 'jwk' })),
    publicKey: Object.freeze(
      createPublicKey(privateKey).export({ format: 'jwk' }),
    ),
  });
};

const vc2JoseSigningVectors = Object.freeze([
  buildSigningVector(KeyAlgorithms.SECP256K1, 'ES256K', SECP256K1_PEM),
  buildSigningVector(KeyAlgorithms.ES256, 'ES256', ES256_PEM),
  buildSigningVector(KeyAlgorithms.RS256, 'RS256', RS256_PEM),
]);

module.exports = { vc2JoseSigningVectors };
