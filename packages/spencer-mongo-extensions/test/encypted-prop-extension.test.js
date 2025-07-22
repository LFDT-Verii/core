/*
 * Copyright 2024 Velocity Team
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

const { nanoid } = require('nanoid');
const { decryptCollection, encryptCollection } = require('@verii/crypto');
const { omit } = require('lodash/fp');
const { initEncryptPropExtension } = require('../src/encrypted-prop-extension');

describe('encrypted prop extension', () => {
  const object = { a: '1', b: 2, c: true };
  const mockParent = {
    prepModification: jest.fn().mockImplementation((arg) => arg),
    findOne: jest.fn().mockImplementation(() => object),
    insert: jest.fn().mockImplementation((val) => ({ _id: nanoid(), ...val })),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('prepModification', () => {
    it('should pass through if prop is missing on val', () => {
      const secret = nanoid();
      const val = {
        y: 3,
      };
      const encryptPropExtension = initEncryptPropExtension({
        prop: 'x',
        encryptedProp: 'encryptedX',
        secret,
        format: 'json',
      });
      const modification =
        encryptPropExtension(mockParent).prepModification(val);

      expect(modification).toEqual({ y: 3 });
    });
    it('should encrypt if prop is set on val', () => {
      const secret = nanoid();
      const val = {
        x: { a: '1', b: '2' },
        y: 3,
      };
      const encryptPropExtension = initEncryptPropExtension({
        prop: 'x',
        encryptedProp: 'encryptedX',
        secret,
        format: 'json',
      });
      const modification =
        encryptPropExtension(mockParent).prepModification(val);

      expect(modification).toEqual({ encryptedX: expect.any(String), y: 3 });
      expect(
        JSON.parse(decryptCollection(modification.encryptedX, secret))
      ).toEqual(val.x);
    });
    it('should encrypt identical encrypted prop', () => {
      const secret = nanoid();
      const val = {
        x: { a: '1', b: '2' },
        y: 3,
      };
      const encryptPropExtension = initEncryptPropExtension({
        prop: 'x',
        encryptedProp: 'x',
        secret,
        format: 'json',
      });
      const modification =
        encryptPropExtension(mockParent).prepModification(val);

      expect(modification).toEqual({ x: expect.any(String), y: 3 });
      expect(JSON.parse(decryptCollection(modification.x, secret))).toEqual(
        val.x
      );
    });

    it('should encrypt deep encrypted prop', () => {
      const secret = nanoid();
      const val = {
        x: { a: '1', b: '2' },
        y: 3,
      };
      const encryptPropExtension = initEncryptPropExtension({
        prop: 'x.a',
        encryptedProp: 'x.encryptedA',
        secret,
        format: 'string',
      });
      const modification =
        encryptPropExtension(mockParent).prepModification(val);

      expect(modification).toEqual({
        x: { encryptedA: expect.any(String), b: '2' },
        y: 3,
      });
      expect(decryptCollection(modification.x.encryptedA, secret)).toEqual('1');
    });
    it('should be able to use a default string format if not using jwk', () => {
      const secret = nanoid();
      const val = {
        x: 'hello-world',
        y: 3,
      };
      const encryptPropExtension = initEncryptPropExtension({
        prop: 'x',
        encryptedProp: 'encryptedX',
        secret,
      });
      const modification =
        encryptPropExtension(mockParent).prepModification(val);

      expect(modification).toEqual({ encryptedX: expect.any(String), y: 3 });
      expect(decryptCollection(modification.encryptedX, secret)).toEqual(val.x);
    });
  });

  describe('insert', () => {
    it('should be able to insert a secret', async () => {
      const secret = nanoid();
      const val = {
        x: 'hello-world',
        y: 3,
      };
      const encryptPropExtension = initEncryptPropExtension({
        prop: 'x',
        encryptedProp: 'encryptedX',
        secret,
      });
      const insertedVal = await encryptPropExtension(mockParent).insert(val);

      expect(insertedVal).toEqual({ _id: expect.any(String), ...val });
      expect(mockParent.insert.mock.calls).toEqual([[val, undefined]]);
    });

    it('should be able to insert a secret and return it in the projection', async () => {
      const secret = nanoid();
      const val = {
        x: 'hello-world',
        y: 3,
      };
      const encryptPropExtension = initEncryptPropExtension({
        prop: 'x',
        encryptedProp: 'encryptedX',
        secret,
      });
      const insertedVal = await encryptPropExtension(mockParent).insert(val, {
        x: 1,
      });

      expect(insertedVal).toEqual({ _id: expect.any(String), ...val });
      expect(mockParent.insert.mock.calls).toEqual([[val, { encryptedX: 1 }]]);
    });
  });

  describe('findOneAndDecrypt', () => {
    const filter = { _id: 1 };
    it('should do nothing if encrypted property is missing from record', async () => {
      const secret = nanoid();
      const val = {
        y: 3,
      };
      const encryptPropExtension = initEncryptPropExtension({
        prop: 'x',
        encryptedProp: 'encryptedX',
        secret,
        format: 'json',
      });
      mockParent.findOne.mockImplementation(() => Promise.resolve(val));
      expect(
        await encryptPropExtension(mockParent).findOneAndDecrypt(
          { filter },
          { x: 1 }
        )
      ).toEqual({
        y: 3,
      });
      expect(mockParent.findOne.mock.calls).toEqual([
        [{ filter }, { encryptedX: 1 }],
      ]);
    });
    it('should do nothing if encrypted property is missing from projection', async () => {
      const secret = nanoid();
      const val = {
        y: 3,
      };
      const encryptPropExtension = initEncryptPropExtension({
        prop: 'x',
        encryptedProp: 'encryptedX',
        secret,
        format: 'json',
      });
      mockParent.findOne.mockImplementation(() => Promise.resolve(val));
      expect(
        await encryptPropExtension(mockParent).findOneAndDecrypt(
          { filter },
          { y: 1 }
        )
      ).toEqual({
        y: 3,
      });

      expect(mockParent.findOne.mock.calls).toEqual([[{ filter }, { y: 1 }]]);
    });

    it('should do nothing if no projection', async () => {
      const secret = nanoid();
      const val = {
        y: 3,
      };
      const encryptPropExtension = initEncryptPropExtension({
        prop: 'x',
        encryptedProp: 'encryptedX',
        secret,
        format: 'json',
      });
      mockParent.findOne.mockImplementation(() => Promise.resolve(val));
      expect(
        await encryptPropExtension(mockParent).findOneAndDecrypt({ filter })
      ).toEqual({
        y: 3,
      });
      expect(mockParent.findOne.mock.calls).toEqual([[{ filter }, undefined]]);
    });
    it('should do nothing if result is null', async () => {
      const secret = nanoid();
      const encryptPropExtension = initEncryptPropExtension({
        prop: 'x',
        encryptedProp: 'encryptedX',
        secret,
        format: 'json',
      });
      mockParent.findOne.mockImplementation(() => Promise.resolve(null));
      expect(
        await encryptPropExtension(mockParent).findOneAndDecrypt({ filter })
      ).toEqual(null);
      expect(mockParent.findOne.mock.calls).toEqual([[{ filter }, undefined]]);
    });
    it('should decrypt encrypted json', async () => {
      const secret = nanoid();
      const val = {
        y: 3,
        encryptedX: encryptCollection(JSON.stringify({ a: 3 }), secret),
      };
      const encryptPropExtension = initEncryptPropExtension({
        prop: 'x',
        encryptedProp: 'encryptedX',
        secret,
        format: 'json',
      });
      mockParent.findOne.mockImplementation(() => Promise.resolve(val));
      expect(
        await encryptPropExtension(mockParent).findOneAndDecrypt(
          { filter },
          { x: 1 }
        )
      ).toEqual({
        ...omit(['encryptedX'], val),
        x: { a: 3 },
      });
      expect(mockParent.findOne.mock.calls).toEqual([
        [{ filter }, { encryptedX: 1 }],
      ]);
    });
    it('should decrypt into the same field if so configured', async () => {
      const secret = nanoid();
      const val = {
        x: encryptCollection(JSON.stringify({ a: 3 }), secret),
      };
      const encryptPropExtension = initEncryptPropExtension({
        prop: 'x',
        encryptedProp: 'x',
        secret,
        format: 'json',
      });
      mockParent.findOne.mockImplementation(() => Promise.resolve(val));
      expect(
        await encryptPropExtension(mockParent).findOneAndDecrypt(
          { filter },
          { x: 1 }
        )
      ).toEqual({
        x: { a: 3 },
      });
      expect(mockParent.findOne.mock.calls).toEqual([[{ filter }, { x: 1 }]]);
    });
    it('should decrypt encrypted json at deep paths', async () => {
      const secret = nanoid();
      const val = {
        y: 3,
        a: {
          b: {
            encryptedC: encryptCollection(JSON.stringify({ a: 3 }), secret),
          },
        },
      };
      const encryptPropExtension = initEncryptPropExtension({
        prop: 'a.b.c',
        encryptedProp: 'a.b.encryptedC',
        secret,
        format: 'json',
      });
      mockParent.findOne.mockImplementation(() => Promise.resolve(val));
      expect(
        await encryptPropExtension(mockParent).findOneAndDecrypt(
          { filter },
          { 'a.b.c': 1 }
        )
      ).toEqual({
        ...omit(['a.b.encryptedC'], val),
        a: { b: { c: { a: 3 } } },
      });
      expect(mockParent.findOne.mock.calls).toEqual([
        [{ filter }, { 'a.b.encryptedC': 1 }],
      ]);
    });
    it('should decrypt encrypted string', async () => {
      const secret = nanoid();
      const val = {
        y: 3,
        encryptedX: encryptCollection('helloworld', secret),
      };
      const encryptPropExtension = initEncryptPropExtension({
        prop: 'x',
        encryptedProp: 'encryptedX',
        secret,
        format: 'string',
      });
      mockParent.findOne.mockImplementation(() => Promise.resolve(val));
      expect(
        await encryptPropExtension(mockParent).findOneAndDecrypt(
          { filter },
          { x: 1 }
        )
      ).toEqual({
        ...omit(['encryptedX'], val),
        x: 'helloworld',
      });
      expect(mockParent.findOne.mock.calls).toEqual([
        [{ filter }, { encryptedX: 1 }],
      ]);
    });
  });
});
