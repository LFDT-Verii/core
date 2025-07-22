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

const {
  Algorithms,
  EC2KeyParameters,
  EllipticCurves,
  KeyTypes,
} = require('../src/cose-iana');

const { CoseKey } = require('../src/cose-key');

const { isEcYValueEven, deriveEcYValue } = require('../src/derive-ec-y-values');

describe('COSE key tests', () => {
  it('ECDSA 256-Bit COSE Key', async () => {
    const key = new CoseKey();
    key.kty = KeyTypes.EC2;
    key.alg = Algorithms.ES256;
    key
      .setParam(EC2KeyParameters.Crv, EllipticCurves.P_256)
      .setParam(
        EC2KeyParameters.X,
        Buffer.from(
          '143329cce7868e416927599cf65a34f3ce2ffda55a7eca69ed8919a394d42f0f',
          'hex'
        )
      )
      .setParam(
        EC2KeyParameters.Y,
        Buffer.from(
          '60f7f1a780d8a783bfb7a2dd6b2796e8128dbbcef9d3d168db9529971a36e7b9',
          'hex'
        )
      )
      .setParam(
        EC2KeyParameters.D,
        Buffer.from(
          '6c1382765aec5358f117733d281c1c7bdc39884d04a45a1e6c67c858bc206c19',
          'hex'
        )
      );
    const expected =
      // eslint-disable-next-line max-len
      'a6010203262001215820143329cce7868e416927599cf65a34f3ce2ffda55a7eca69ed8919a394d42f0f22582060f7f1a780d8a783bfb7a2dd6b2796e8128dbbcef9d3d168db9529971a36e7b92358206c1382765aec5358f117733d281c1c7bdc39884d04a45a1e6c67c858bc206c19';
    expect(Buffer.from(await key.toBytes()).toString('hex')).toEqual(expected);
    expect(Buffer.from(key.getSecret()).toString('hex')).toEqual(
      '6c1382765aec5358f117733d281c1c7bdc39884d04a45a1e6c67c858bc206c19'
    );
    expect((await key.toBytes()).length).toEqual(112);

    const key2 = await CoseKey.fromBytes(Buffer.from(expected, 'hex'));
    expect(Buffer.from(await key2.toBytes()).toString('hex')).toEqual(expected);
  });
  it('ECDSA 256-Bit COSE Key using compression', async () => {
    const point = {
      x: '143329cce7868e416927599cf65a34f3ce2ffda55a7eca69ed8919a394d42f0f',
      y: '60f7f1a780d8a783bfb7a2dd6b2796e8128dbbcef9d3d168db9529971a36e7b9',
    };
    const key = new CoseKey();
    key.kty = KeyTypes.EC2;
    key.alg = Algorithms.ES256;
    key
      .setParam(EC2KeyParameters.Crv, EllipticCurves.P_256)
      .setParam(EC2KeyParameters.X, Buffer.from(point.x, 'hex'))
      .setParam(
        EC2KeyParameters.Y,
        isEcYValueEven(Buffer.from(point.y, 'hex'))
      );
    const expected =
      // eslint-disable-next-line max-len
      'a5010203262001215820143329cce7868e416927599cf65a34f3ce2ffda55a7eca69ed8919a394d42f0f22f4';
    expect(Buffer.from(await key.toBytes()).toString('hex')).toEqual(expected);
    expect(
      Buffer.from(key.getParam(EC2KeyParameters.X)).toString('hex')
    ).toEqual(point.x);
    expect(key.getParam(EC2KeyParameters.Y)).toEqual(false);
    expect((await key.toBytes()).length).toEqual(44);
    expect(
      deriveEcYValue(
        'P-256',
        Buffer.from(point.x, 'hex'),
        key.getParam(EC2KeyParameters.Y)
      ).toString('hex')
    ).toEqual(point.y);

    const key2 = await CoseKey.fromBytes(Buffer.from(expected, 'hex'));
    expect(Buffer.from(await key2.toBytes()).toString('hex')).toEqual(expected);
  });

  const secp256k1Key = {
    kty: 'EC',
    x: 'Nn4ZFV2EA5J5nTfBG4P0cpvIrVikFcCiT332FigxqJ0',
    y: 'DGSYBZSVEo3OetfTn4giXGz_JcKIM0Sgzln73nOS9ok',
    crv: 'secp256k1',
  };

  it('ECDSA 256-Bit K1 COSE Key', async () => {
    const key = new CoseKey();
    key.kty = KeyTypes.EC2;
    key.alg = Algorithms.ES256;
    key
      .setParam(EC2KeyParameters.Crv, EllipticCurves.Secp256k1)
      .setParam(EC2KeyParameters.X, Buffer.from(secp256k1Key.x, 'base64url'))
      .setParam(EC2KeyParameters.Y, Buffer.from(secp256k1Key.y, 'base64url'));
    const expected =
      // eslint-disable-next-line max-len
      'a5010203262008215820367e19155d840392799d37c11b83f4729bc8ad58a415c0a24f7df6162831a89d2258200c6498059495128dce7ad7d39f88225c6cff25c2883344a0ce59fbde7392f689';
    expect(Buffer.from(await key.toBytes()).toString('hex')).toEqual(expected);
    expect((await key.toBytes()).length).toEqual(77);
    expect(
      Buffer.from(key.getParam(EC2KeyParameters.X)).toString('base64url')
    ).toEqual(secp256k1Key.x);
    expect(
      Buffer.from(key.getParam(EC2KeyParameters.Y)).toString('base64url')
    ).toEqual(secp256k1Key.y);
    const key2 = await CoseKey.fromBytes(Buffer.from(expected, 'hex'));
    expect(Buffer.from(await key2.toBytes()).toString('hex')).toEqual(expected);
  });
  it('ECDSA 256-Bit K1 COSE Key using compression', async () => {
    const key = new CoseKey();
    key.kty = KeyTypes.EC2;
    key.alg = Algorithms.ES256;
    key
      .setParam(EC2KeyParameters.Crv, EllipticCurves.P_256)
      .setParam(EC2KeyParameters.X, Buffer.from(secp256k1Key.x, 'base64url'))
      .setParam(
        EC2KeyParameters.Y,
        isEcYValueEven(Buffer.from(secp256k1Key.y, 'base64url'))
      );
    expect(key.alg).toEqual(Algorithms.ES256);
    const expected =
      // eslint-disable-next-line max-len
      'a5010203262001215820367e19155d840392799d37c11b83f4729bc8ad58a415c0a24f7df6162831a89d22f4';
    expect(Buffer.from(await key.toBytes()).toString('hex')).toEqual(expected);
    expect(
      Buffer.from(key.getParam(EC2KeyParameters.X)).toString('base64url')
    ).toEqual(secp256k1Key.x);
    expect(key.getParam(EC2KeyParameters.Y)).toEqual(false);
    expect((await key.toBytes()).length).toEqual(44);
    expect(
      deriveEcYValue(
        'secp256k1',
        Buffer.from(key.getParam(EC2KeyParameters.X)).toString('hex'),
        key.getParam(EC2KeyParameters.Y)
      ).toString('base64url')
    ).toEqual(secp256k1Key.y);

    const key2 = await CoseKey.fromBytes(Buffer.from(expected, 'hex'));
    expect(Buffer.from(await key2.toBytes()).toString('hex')).toEqual(expected);
  });
  it('should get and set kid parameter', async () => {
    const key = new CoseKey();
    const kid = Buffer.from('my-key-id');
    key.kid = kid;
    expect(Buffer.from(key.kid)).toEqual(kid);
  });

  it('should get and set iv parameter', async () => {
    const key = new CoseKey();
    const iv = Buffer.from('initial-vector');
    key.baseIV = iv;
    expect(Buffer.from(key.baseIV)).toEqual(iv);
  });

  it('should get and set key operations', async () => {
    const key = new CoseKey();
    const ops = [1, 2, 3];
    key.ops = ops;
    expect(key.ops).toEqual(ops);
  });
});
