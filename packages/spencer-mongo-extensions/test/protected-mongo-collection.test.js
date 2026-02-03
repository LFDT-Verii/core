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
const { beforeEach, describe, it, mock } = require('node:test');
const { expect } = require('expect');

const { encryptCollection } = require('@verii/crypto');
const {
  initPrepModification,
  initFindOneAndDecryptSecret,
  initFindAndDecryptSecret,
} = require('../src/protected-mongo-collection');

describe('Protected mongo collection functionality test suite', () => {
  beforeEach(async () => {});

  describe('initFindOneAndDecryptSecret test suite', () => {
    describe('format hex', () => {
      const mockSecretPropName = 'foo';
      const mockSecretPropUnencryptedValue = 'bar';
      const mockSecret = 'secret';
      const encryptedValue = encryptCollection(
        mockSecretPropUnencryptedValue,
        mockSecret,
      );
      const mockContext = {
        config: {
          mongoSecret: mockSecret,
        },
      };
      const mockDefaultProjection = {
        [mockSecretPropName]: 1,
      };
      const mockItemType = 'test-item-type';
      const mockFilter = {
        filter: 'filter',
      };

      it('findOneAndDecryptSecret should error when findOne returns null', async () => {
        const mockParent = {
          findOne: mock.fn(() => Promise.resolve(null)),
        };

        const findOneAndDecryptSecret = initFindOneAndDecryptSecret({
          parent: mockParent,
          context: mockContext,
          itemType: mockItemType,
          defaultProjection: mockDefaultProjection,
          secretPropName: mockSecretPropName,
          format: 'hex',
        });
        const func = async () => {
          return findOneAndDecryptSecret({ filter: mockFilter });
        };
        await expect(func).rejects.toThrow(
          `No ${mockItemType} matching the filter ${JSON.stringify(
            mockFilter,
          )} was found`,
        );
      });

      it('findOneAndDecryptSecret should error when secret prop key is not found on object', async () => {
        const mockParent = {
          findOne: mock.fn(() => Promise.resolve({ 'not-foo': 'not-bar' })),
        };

        const findOneAndDecryptSecret = initFindOneAndDecryptSecret({
          parent: mockParent,
          context: mockContext,
          itemType: mockItemType,
          defaultProjection: mockDefaultProjection,
          secretPropName: mockSecretPropName,
          format: 'hex',
        });
        const func = async () => {
          return findOneAndDecryptSecret({ filter: mockFilter });
        };
        await expect(func).rejects.toThrow(
          `No ${mockSecretPropName} set on ${mockItemType} matching the filter ${JSON.stringify(
            mockFilter,
          )}`,
        );
      });

      it('findOneAndDecryptSecret should properly decrypt an encrypted property', async () => {
        const mockParent = {
          findOne: mock.fn(() =>
            Promise.resolve({ [mockSecretPropName]: encryptedValue }),
          ),
        };

        const findOneAndDecryptSecret = initFindOneAndDecryptSecret({
          parent: mockParent,
          context: mockContext,
          itemType: mockItemType,
          defaultProjection: mockDefaultProjection,
          secretPropName: mockSecretPropName,
          format: 'hex',
        });
        const returnValue = await findOneAndDecryptSecret({});
        expect(returnValue).toEqual({
          [mockSecretPropName]: mockSecretPropUnencryptedValue,
        });
      });
    });

    describe('format jwk', () => {
      const mockSecretPropName = 'foo';
      const mockSecretPropUnencryptedValue = {
        kty: 'oct',
        kid: 'kid',
        use: 'enc',
        alg: 'alg',
        k: 'k',
      };
      const mockSecret = 'secret';
      const encryptedValue = encryptCollection(
        JSON.stringify(mockSecretPropUnencryptedValue),
        mockSecret,
      );
      const mockContext = {
        config: {
          mongoSecret: mockSecret,
        },
      };
      const mockDefaultProjection = {
        [mockSecretPropName]: 1,
      };
      const mockItemType = 'test-item-type';
      const mockFilter = {
        filter: 'filter',
      };

      it('findOneAndDecryptSecret should error when findOne returns null', async () => {
        const mockParent = {
          findOne: mock.fn(() => Promise.resolve(null)),
        };

        const findOneAndDecryptSecret = initFindOneAndDecryptSecret({
          parent: mockParent,
          context: mockContext,
          itemType: mockItemType,
          defaultProjection: mockDefaultProjection,
          secretPropName: mockSecretPropName,
        });
        const func = async () => {
          return findOneAndDecryptSecret({ filter: mockFilter });
        };
        await expect(func).rejects.toThrow(
          `No ${mockItemType} matching the filter ${JSON.stringify(
            mockFilter,
          )} was found`,
        );
      });

      it('findOneAndDecryptSecret should error when secret prop key is not found on object', async () => {
        const mockParent = {
          findOne: mock.fn(() =>
            Promise.resolve({
              'not-foo': 'not-bar',
            }),
          ),
        };

        const findOneAndDecryptSecret = initFindOneAndDecryptSecret({
          parent: mockParent,
          context: mockContext,
          itemType: mockItemType,
          defaultProjection: mockDefaultProjection,
          secretPropName: mockSecretPropName,
        });
        const func = async () => {
          return findOneAndDecryptSecret({ filter: mockFilter });
        };
        await expect(func).rejects.toThrow(
          `No ${mockSecretPropName} set on ${mockItemType} matching the filter ${JSON.stringify(
            mockFilter,
          )}`,
        );
      });

      it('findOneAndDecryptSecret should properly decrypt an encrypted property', async () => {
        const mockParent = {
          findOne: mock.fn(() =>
            Promise.resolve({ [mockSecretPropName]: encryptedValue }),
          ),
        };

        const findOneAndDecryptSecret = initFindOneAndDecryptSecret({
          parent: mockParent,
          context: mockContext,
          itemType: mockItemType,
          defaultProjection: mockDefaultProjection,
          secretPropName: mockSecretPropName,
        });
        const returnValue = await findOneAndDecryptSecret({});
        expect(returnValue).toEqual({
          [mockSecretPropName]: mockSecretPropUnencryptedValue,
        });
      });
    });
  });

  describe('initFindAndDecryptSecret test suite', () => {
    describe('format hex', () => {
      const mockSecretPropName = 'foo';
      const mockSecretPropUnencryptedValue = 'bar';
      const mockSecret = 'secret';
      const encryptedValue = encryptCollection(
        mockSecretPropUnencryptedValue,
        mockSecret,
      );
      const mockContext = {
        config: {
          mongoSecret: mockSecret,
        },
      };
      const mockDefaultProjection = {
        [mockSecretPropName]: 1,
      };
      const mockItemType = 'test-item-type';
      const mockFilter = {
        filter: 'filter',
      };

      it('findAndDecryptSecret should return empty array', async () => {
        const mockParent = {
          find: mock.fn(() => Promise.resolve(null)),
        };

        const findAndDecryptSecret = initFindAndDecryptSecret({
          parent: mockParent,
          context: mockContext,
          itemType: mockItemType,
          defaultProjection: mockDefaultProjection,
          secretPropName: mockSecretPropName,
          format: 'hex',
        });
        const result = await findAndDecryptSecret({ filter: mockFilter });
        expect(result).toEqual([]);
      });

      it('findAndDecryptSecret should error when secret prop key is not found on object', async () => {
        const mockParent = {
          find: mock.fn(() =>
            Promise.resolve([
              {
                'not-foo': 'not-bar',
              },
            ]),
          ),
        };

        const findAndDecryptSecret = initFindAndDecryptSecret({
          parent: mockParent,
          context: mockContext,
          itemType: mockItemType,
          defaultProjection: mockDefaultProjection,
          secretPropName: mockSecretPropName,
          format: 'hex',
        });
        const func = async () => {
          return findAndDecryptSecret({ filter: mockFilter });
        };
        await expect(func).rejects.toThrow(
          `No ${mockSecretPropName} set on ${mockItemType} matching the filter ${JSON.stringify(
            mockFilter,
          )}`,
        );
      });

      it('findAndDecryptSecret should properly decrypt an encrypted property', async () => {
        const mockParent = {
          find: mock.fn(() =>
            Promise.resolve([{ [mockSecretPropName]: encryptedValue }]),
          ),
        };

        const findAndDecryptSecret = initFindAndDecryptSecret({
          parent: mockParent,
          context: mockContext,
          itemType: mockItemType,
          defaultProjection: mockDefaultProjection,
          secretPropName: mockSecretPropName,
          format: 'hex',
        });
        const returnValue = await findAndDecryptSecret({});
        expect(returnValue).toEqual([
          {
            [mockSecretPropName]: mockSecretPropUnencryptedValue,
          },
        ]);
      });
    });

    describe('format jwk', () => {
      const mockSecretPropName = 'foo';
      const mockSecretPropUnencryptedValue = {
        kty: 'oct',
        kid: 'kid',
        use: 'enc',
        alg: 'alg',
        k: 'k',
      };
      const mockSecret = 'secret';
      const encryptedValue = encryptCollection(
        JSON.stringify(mockSecretPropUnencryptedValue),
        mockSecret,
      );
      const mockContext = {
        config: {
          mongoSecret: mockSecret,
        },
      };
      const mockDefaultProjection = {
        [mockSecretPropName]: 1,
      };
      const mockItemType = 'test-item-type';
      const mockFilter = {
        filter: 'filter',
      };

      it('findAndDecryptSecret should return empty array', async () => {
        const mockParent = {
          find: mock.fn(() => Promise.resolve(null)),
        };

        const findAndDecryptSecret = initFindAndDecryptSecret({
          parent: mockParent,
          context: mockContext,
          itemType: mockItemType,
          defaultProjection: mockDefaultProjection,
          secretPropName: mockSecretPropName,
        });
        const result = await findAndDecryptSecret({ filter: mockFilter });
        expect(result).toEqual([]);
      });

      it('findAndDecryptSecret should error when secret prop key is not found on object', async () => {
        const mockParent = {
          find: mock.fn(() =>
            Promise.resolve([
              {
                'not-foo': 'not-bar',
              },
            ]),
          ),
        };

        const findAndDecryptSecret = initFindAndDecryptSecret({
          parent: mockParent,
          context: mockContext,
          itemType: mockItemType,
          defaultProjection: mockDefaultProjection,
          secretPropName: mockSecretPropName,
        });
        const func = async () => {
          return findAndDecryptSecret({ filter: mockFilter });
        };
        await expect(func).rejects.toThrow(
          `No ${mockSecretPropName} set on ${mockItemType} matching the filter ${JSON.stringify(
            mockFilter,
          )}`,
        );
      });

      it('findAndDecryptSecret should properly decrypt an encrypted property', async () => {
        const mockParent = {
          find: mock.fn(() =>
            Promise.resolve([{ [mockSecretPropName]: encryptedValue }]),
          ),
        };

        const findAndDecryptSecret = initFindAndDecryptSecret({
          parent: mockParent,
          context: mockContext,
          itemType: mockItemType,
          defaultProjection: mockDefaultProjection,
          secretPropName: mockSecretPropName,
        });
        const returnValue = await findAndDecryptSecret({});
        expect(returnValue).toEqual([
          {
            [mockSecretPropName]: mockSecretPropUnencryptedValue,
          },
        ]);
      });
    });
  });

  describe('initPrepModification test suite', () => {
    describe('format hex', () => {
      const mockSecretPropName = 'foo';
      const mockSecretPropUnencryptedValue = 'bar';
      const mockSecret = 'secret';
      const encryptedValue = encryptCollection(
        mockSecretPropUnencryptedValue,
        mockSecret,
      );
      const mockContext = {
        config: {
          mongoSecret: mockSecret,
        },
      };

      it('prepModification should properly decrypt an encrypted property', async () => {
        const mockParent = {
          prepModification: mock.fn(() =>
            Promise.resolve({ [mockSecretPropName]: encryptedValue }),
          ),
        };

        const prepModification = initPrepModification({
          parent: mockParent,
          context: mockContext,
          secretPropName: mockSecretPropName,
          format: 'hex',
        });
        const returnValue = await prepModification({
          [mockSecretPropName]: mockSecretPropUnencryptedValue,
        });
        expect(returnValue).toEqual({
          [mockSecretPropName]: encryptedValue,
        });
      });

      it('prepModification should get proper value from provided value', async () => {
        const mockParent = {
          prepModification: mock.fn(() =>
            Promise.resolve({ [mockSecretPropName]: encryptedValue }),
          ),
        };

        const prepModification = initPrepModification({
          parent: mockParent,
          context: mockContext,
          secretPropName: 'foo.foo',
          format: 'hex',
        });
        const returnValue = await prepModification({
          [mockSecretPropName]: { foo: mockSecretPropUnencryptedValue },
        });
        expect(returnValue).toEqual({
          [mockSecretPropName]: encryptedValue,
        });
      });
    });

    describe('format jwk', () => {
      const mockSecretPropName = 'foo';
      const mockSecretPropUnencryptedValue = {
        kty: 'oct',
        kid: 'kid',
        use: 'enc',
        alg: 'alg',
        k: 'k',
      };
      const mockSecret = 'secret';
      const encryptedValue = encryptCollection(
        JSON.stringify(mockSecretPropUnencryptedValue),
        mockSecret,
      );
      const mockContext = {
        config: {
          mongoSecret: mockSecret,
        },
      };

      it('prepModification should properly decrypt an encrypted property', async () => {
        const mockParent = {
          prepModification: mock.fn(() =>
            Promise.resolve({ [mockSecretPropName]: encryptedValue }),
          ),
        };

        const prepModification = initPrepModification({
          parent: mockParent,
          context: mockContext,
          secretPropName: mockSecretPropName,
        });
        const returnValue = await prepModification({
          [mockSecretPropName]: mockSecretPropUnencryptedValue,
        });
        expect(returnValue).toEqual({
          [mockSecretPropName]: encryptedValue,
        });
      });

      it('prepModification should get proper value from provided value', async () => {
        const mockParent = {
          prepModification: mock.fn(() =>
            Promise.resolve({ [mockSecretPropName]: encryptedValue }),
          ),
        };

        const prepModification = initPrepModification({
          parent: mockParent,
          context: mockContext,
          secretPropName: 'foo.foo',
        });
        const returnValue = await prepModification({
          [mockSecretPropName]: { foo: mockSecretPropUnencryptedValue },
        });
        expect(returnValue).toEqual({
          [mockSecretPropName]: encryptedValue,
        });
      });
    });
  });
});
