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
const { beforeEach, describe, it } = require('node:test');
const { expect } = require('expect');

const { rootIssuer } = require('@verii/sample-data');
const {
  extractService,
  createDidDoc,
  addKeysToDidDoc,
  addServiceToDidDoc,
  buildDidDocWithAlternativeId,
  getDidAndAliases,
  isDidMatching,
  removeKeyFromDidDoc,
  removeServiceFromDidDoc,
  updateServicesOnDidDoc,
} = require('../src/did-doc');

describe('Did doc functions test suite', () => {
  describe('Create Did Doc Test Suite', () => {
    it('should error if did doc id is invalid ', () => {
      expect(() =>
        createDidDoc({
          did: 123,
          keys: [
            {
              id: 'fooKeyId1',
              extraProp: 'fooKeyExtra1',
              publicKey: { x: 'foo' },
            },
          ],
          services: [
            {
              id: 'fooServiceId1',
              extraProp: 'fooServiceExtra1',
              type: 'fooType',
              serviceEndpoint: 'fooServiceEndpoint',
            },
          ],
          alsoKnownAs: 'did:foo2:bar',
        })
      ).toThrow('DID Document id is not valid');
    });
    it('should error if did doc contains duplicate services', () => {
      expect(() =>
        createDidDoc({
          did: 'did:foo:bar',
          services: [
            {
              id: 'fooServiceId1',
              extraProp: 'fooServiceExtra1',
              type: 'fooType',
              serviceEndpoint: 'fooServiceEndpoint',
            },
            {
              id: 'fooServiceId1',
              extraProp: 'fooServiceExtra1',
              type: 'fooType',
              serviceEndpoint: 'fooServiceEndpoint',
            },
          ],
        })
      ).toThrow('DID Document services not unique');
    });
    it('should return a did doc with keys, services, and alsoKnownAs', () => {
      const { didDoc } = createDidDoc({
        did: 'did:foo:bar',
        keys: [
          {
            id: 'fooKeyId1',
            extraProp: 'fooKeyExtra1',
            publicKey: { x: 'foo' },
          },
        ],
        services: [
          {
            id: 'fooServiceId1',
            extraProp: 'fooServiceExtra1',
            type: 'fooType',
            serviceEndpoint: 'fooServiceEndpoint',
          },
        ],
        alsoKnownAs: 'did:foo2:bar',
      });
      expect(didDoc).toEqual({
        '@context': ['https://www.w3.org/ns/did/v1'],
        id: 'did:foo:bar',
        verificationMethod: [
          {
            id: 'fooKeyId1',
            type: 'JsonWebKey2020',
            controller: 'did:foo:bar',
            publicKeyJwk: { x: 'foo' },
          },
        ],
        assertionMethod: ['fooKeyId1'],
        service: [
          {
            id: 'fooServiceId1',
            type: 'fooType',
            serviceEndpoint: 'fooServiceEndpoint',
          },
        ],
        alsoKnownAs: ['did:foo2:bar'],
      });
    });
  });

  describe('Key Addition', () => {
    it('Should add a key to the DID Document', () => {
      const verificationMethod1 = {
        id: 'barId',
        controller: 'did:foo:bar',
        type: 'fooType',
        publicKeyFoo: {
          crv: 'fooCurve',
          x: 'foox',
          y: 'fooY',
          kty: 'fooKty',
        },
      };
      const didDoc = {
        id: 'did:foo:bar',
        verificationMethod: [verificationMethod1],
        assertionMethod: ['barId'],
      };
      const key = {
        id: 'fooId',
        publicKey: {
          crv: 'Ed25519',
          x: 'VCpo2LMLhn6iWku8MKvSLg2ZAoC-nlOyPVQaO3FxVeQ',
          kty: 'OKP',
          d: 'secret',
          kid: '_Qq0UL2Fq651Q0Fjd6TvnYE-faHiOpRlPVQcY_-tA4A',
        },
      };
      const { didDoc: newDidDoc, newVerificationMethods } = addKeysToDidDoc({
        didDoc,
        keys: [key],
      });

      expect(newDidDoc).toEqual({
        ...didDoc,
        verificationMethod: [
          verificationMethod1,
          {
            id: 'fooId',
            type: 'JsonWebKey2020',
            controller: 'did:foo:bar',
            publicKeyJwk: {
              crv: 'Ed25519',
              x: 'VCpo2LMLhn6iWku8MKvSLg2ZAoC-nlOyPVQaO3FxVeQ',
              kty: 'OKP',
            },
          },
        ],
        assertionMethod: [verificationMethod1.id, 'fooId'],
      });

      expect(newVerificationMethods).toEqual([
        {
          id: 'fooId',
          type: 'JsonWebKey2020',
          controller: 'did:foo:bar',
          publicKeyJwk: {
            crv: 'Ed25519',
            x: 'VCpo2LMLhn6iWku8MKvSLg2ZAoC-nlOyPVQaO3FxVeQ',
            kty: 'OKP',
          },
        },
      ]);
    });
    it('Should not add a key with unknown type', () => {
      const verificationMethod1 = {
        id: 'barId',
        controller: 'did:foo:bar',
        type: 'fooType',
        publicKeyFoo: {
          crv: 'fooCurve',
          x: 'foox',
          y: 'fooY',
          kty: 'fooKty',
        },
      };
      const didDoc = {
        id: 'did:foo:bar',
        verificationMethod: [verificationMethod1],
        assertionMethod: ['barId'],
      };
      const key = {
        id: 'fooId',
        publicKey: {
          crv: 'Ed25519',
          x: 'VCpo2LMLhn6iWku8MKvSLg2ZAoC-nlOyPVQaO3FxVeQ',
          kty: 'OKP',
          d: 'secret',
          kid: '_Qq0UL2Fq651Q0Fjd6TvnYE-faHiOpRlPVQcY_-tA4A',
        },
        type: 'foo',
      };
      const { didDoc: newDidDoc, newVerificationMethods } = addKeysToDidDoc({
        didDoc,
        keys: [key],
      });

      expect(newDidDoc).toEqual(didDoc);

      expect(newVerificationMethods).toEqual([]);
    });
  });

  describe('Key Removal', () => {
    it('Should remove a key from the DID Document', () => {
      const verificationMethod1 = {
        id: 'barId',
        controller: 'did:foo:bar',
        type: 'fooType',
        publicKeyFoo: {
          crv: 'fooCurve',
          x: 'foox',
          y: 'fooY',
          kty: 'fooKty',
        },
      };
      const verificationMethod2 = {
        id: 'fooId2',
        controller: 'did:foo:bar',
        type: 'fooType',
        publicKeyFoo: {
          crv: 'fooCurve',
          x: 'foox',
          y: 'fooY',
          kty: 'fooKty',
        },
      };
      const didDoc = {
        id: 'did:foo:bar',
        verificationMethod: [verificationMethod1, verificationMethod2],
        assertionMethod: [verificationMethod1.id, verificationMethod2.id],
      };
      const { didDoc: newDidDoc } = removeKeyFromDidDoc({
        didDoc,
        keyId: verificationMethod2.id,
      });

      expect(newDidDoc).toEqual({
        ...didDoc,
        verificationMethod: [verificationMethod1],
        assertionMethod: [verificationMethod1.id],
      });
    });
  });

  describe('Service Addition', () => {
    let didDoc;
    beforeEach(() => {
      didDoc = {
        '@context': ['https://www.w3.org/ns/did/v1'],
        id: 'did:foo:bar',
        verificationMethod: [
          {
            id: 'fooKeyId1',
            type: 'JsonWebKey2020',
            controller: 'did:foo:bar',
            publicKeyJwk: { x: 'foo' },
          },
        ],
        assertionMethod: ['fooKeyId1'],
        service: [
          {
            id: 'fooServiceId1',
            type: 'fooType',
            serviceEndpoint: 'fooServiceEndpoint',
          },
        ],
        alsoKnownAs: ['did:foo2:bar'],
      };
    });
    it('Should add a service to the didDoc', () => {
      const newService = {
        id: 'fooServiceId2',
        type: 'fooType',
        serviceEndpoint: 'fooServiceEndpoint2',
      };
      const result = addServiceToDidDoc({
        didDoc,
        service: newService,
      });

      expect(result).toEqual({
        didDoc: {
          ...didDoc,
          service: [...didDoc.service, newService],
        },
      });
    });

    it('Should throw an error when organization document is not an object', () => {
      const result = () => removeServiceFromDidDoc('NOT-AN-OBJECT', {});

      expect(result).toThrow(Error);
    });

    it('Should throw an error when service ID is undefined', () => {
      const result = () => removeServiceFromDidDoc({}, undefined);

      expect(result).toThrow(Error);
    });

    it('Should throw an error when service ID is null', () => {
      const result = () => removeServiceFromDidDoc({}, null);

      expect(result).toThrow(Error);
    });

    it('Should throw an error when service ID is not a string', () => {
      const result = () => removeServiceFromDidDoc({}, {});

      expect(result).toThrow(Error);
    });
  });

  describe('Service Update', () => {
    it('Should updates services on the DID Document', () => {
      const service1 = {
        id: 'fooServiceId1',
        type: 'fooType',
        serviceEndpoint: 'foo1.example.com',
      };
      const service2 = {
        id: 'fooServiceId2',
        type: 'fooType',
        serviceEndpoint: 'foo2.example.com',
      };
      const newService = {
        id: 'fooServiceId3',
        type: 'fooType',
        serviceEndpoint: 'foo3.example.com',
      };
      const didDoc = {
        id: 'did:foo:bar',
        service: [service1, service2],
      };
      const { didDoc: newDidDoc } = updateServicesOnDidDoc({
        didDoc,
        services: [
          { ...service1, serviceEndpoint: 'foo1.updated.example.com' },
          newService,
        ],
      });

      expect(newDidDoc).toEqual({
        ...didDoc,
        service: [
          { ...service1, serviceEndpoint: 'foo1.updated.example.com' },
          service2,
        ],
      });
    });
  });

  describe('Service Removal', () => {
    it('Should throw an error when organization document is undefined', () => {
      const result = () => removeServiceFromDidDoc(undefined, {});

      expect(result).toThrow(Error);
    });

    it('Should throw an error when organization document is null', () => {
      const result = () => removeServiceFromDidDoc(null, {});

      expect(result).toThrow(Error);
    });

    it('Should throw an error when organization document is not an object', () => {
      const result = () => removeServiceFromDidDoc('NOT-AN-OBJECT', {});

      expect(result).toThrow(Error);
    });

    it('Should throw an error when service ID is undefined', () => {
      const result = () => removeServiceFromDidDoc({}, undefined);

      expect(result).toThrow(Error);
    });

    it('Should throw an error when service ID is null', () => {
      const result = () => removeServiceFromDidDoc({}, null);

      expect(result).toThrow(Error);
    });

    it('Should throw an error when service ID is not a string', () => {
      const result = () => removeServiceFromDidDoc({}, {});

      expect(result).toThrow(Error);
    });

    it('Should remove service information from the organization document', () => {
      const service1 = {
        id: 'fooServiceId1',
        type: 'fooType',
        serviceEndpoint: 'foo1.example.com',
      };
      const service2 = {
        id: 'fooServiceId2',
        type: 'fooType',
        serviceEndpoint: 'foo2.example.com',
      };
      const didDoc = {
        id: 'did:foo:bar',
        service: [service1, service2],
      };
      const { didDoc: newDidDoc } = removeServiceFromDidDoc({
        didDoc,
        serviceId: service1.id,
      });

      expect(newDidDoc).toEqual({
        ...didDoc,
        service: [service2],
      });
    });
  });

  describe('Service Extraction', () => {
    it('Should throw an error when organization document is undefined', () => {
      const result = () => extractService(undefined, '');

      expect(result).toThrow(Error);
    });

    it('Should throw an error when organization document is null', () => {
      const result = () => extractService(null, '');

      expect(result).toThrow(Error);
    });

    it('Should throw an error when organization document is not an object', () => {
      const result = () => extractService('NOT-AN-OBJECT', '');

      expect(result).toThrow(Error);
    });

    it('Should throw an error when service ID is undefined', () => {
      const result = () => extractService({}, undefined);

      expect(result).toThrow(Error);
    });

    it('Should throw an error when service ID is null', () => {
      const result = () => extractService({}, null);

      expect(result).toThrow(Error);
    });

    it('Should throw an error when service ID is not a string', () => {
      const result = () => extractService({}, 1);

      expect(result).toThrow(Error);
    });

    it('Should throw an error when service does not exist', () => {
      const result = () => extractService(rootIssuer, 'NOT-EXIST-ID');

      expect(result).toThrow(Error);
    });

    it('Should extract service using an absolute service id with an absolute service id defined on the did doc ', () => {
      const result = extractService(rootIssuer, rootIssuer.service[0].id);

      expect(result).toEqual(rootIssuer.service[0]);
    });

    it('Should extract service using an absolute service id with a relative service id defined on the did doc ', () => {
      const relativeServiceId = '#credentialagent-1';
      const absoluteServiceId = rootIssuer.service[0].id;
      const serviceWithRelativeId = {
        ...rootIssuer.service[0],
        id: relativeServiceId,
      };
      const didDoc = {
        ...rootIssuer,
        service: [serviceWithRelativeId],
      };
      const result = extractService(didDoc, absoluteServiceId);

      expect(result).toEqual(serviceWithRelativeId);
    });

    it('Should extract service using a relative service id with an absolute service id defined on the did doc ', () => {
      const relativeServiceId = '#credentialagent-1';
      const result = extractService(rootIssuer, relativeServiceId);

      expect(result).toEqual(rootIssuer.service[0]);
    });

    it('Should extract service using a relative service id with a relative service id defined on the did doc ', () => {
      const relativeServiceId = '#credentialagent-1';
      const serviceWithRelativeId = {
        ...rootIssuer.service[0],
        id: relativeServiceId,
      };
      const didDoc = {
        ...rootIssuer,
        service: [serviceWithRelativeId],
      };
      const result = extractService(didDoc, relativeServiceId);

      expect(result).toEqual(serviceWithRelativeId);
    });
  });

  describe('get dids and aliases', () => {
    it('Should return empty array if no id or alsoKnownAs is present on did doc', () => {
      const didDoc = { foo: 'bar' };
      const dids = getDidAndAliases(didDoc);
      expect(dids).toEqual([]);
    });

    it('Should return array with just the id when alsoKnownAs is not present on did doc', () => {
      const didDoc = { id: 'did:test:foo', foo: 'bar' };
      const dids = getDidAndAliases(didDoc);
      expect(dids).toEqual(['did:test:foo']);
    });

    it('Should return array with just the id when alsoKnownAs array is present but empty', () => {
      const didDoc = { id: 'did:test:foo', foo: 'bar', alsoKnownAs: [] };
      const dids = getDidAndAliases(didDoc);
      expect(dids).toEqual(['did:test:foo']);
    });

    it('Should return array with the id and the aliases when alsoKnownAs array is present on did doc', () => {
      const didDoc = {
        id: 'did:test:foo',
        foo: 'bar',
        alsoKnownAs: ['did:test:bar1', 'did:test:bar2'],
      };
      const dids = getDidAndAliases(didDoc);
      expect(dids).toEqual(['did:test:foo', 'did:test:bar1', 'did:test:bar2']);
    });

    it('Should return array with the id and the alias when alsoKnownAs string is present on did doc', () => {
      const didDoc = {
        id: 'did:test:foo',
        foo: 'bar',
        alsoKnownAs: 'did:test:bar',
      };
      const dids = getDidAndAliases(didDoc);
      expect(dids).toEqual(['did:test:foo', 'did:test:bar']);
    });
  });

  describe('is did matching', () => {
    it('Should return false if did is not present in didDoc', () => {
      const didDoc = { id: 'did:test:bar', alsoKnownAs: ['did:test:bar1'] };
      const result = isDidMatching('did:test:foo', didDoc);
      expect(result).toEqual(false);
    });
    it('Should return true if did is didDoc.id', () => {
      const didDoc = { id: 'did:test:foo' };
      const result = isDidMatching('did:test:foo', didDoc);
      expect(result).toEqual(true);
    });

    it('Should return true if did is alsoKnownAs', () => {
      const didDoc = { alsoKnownAs: 'did:test:foo' };
      const result = isDidMatching('did:test:foo', didDoc);
      expect(result).toEqual(true);
    });

    it('Should return true if did is in alsoKnownAs', () => {
      const didDoc = { alsoKnownAs: ['did:test:foo'] };
      const result = isDidMatching('did:test:foo', didDoc);
      expect(result).toEqual(true);
    });
  });

  describe('buildDidDocWithAlternativeId', () => {
    it('Should not modify did document with when didDoc.id is specified as primary', () => {
      const didDoc = { id: 'did:test:foo', alsoKnownAs: ['did:test:bar'] };
      const result = buildDidDocWithAlternativeId('did:test:foo', didDoc);
      expect(result).toEqual(didDoc);
    });

    it('Should build did document with correct did when alsoKnownAs did is specified as primary', () => {
      const didDoc = { id: 'did:test:foo', alsoKnownAs: ['did:test:bar'] };
      const result = buildDidDocWithAlternativeId('did:test:bar', didDoc);
      expect(result).toEqual({
        id: 'did:test:bar',
        alsoKnownAs: ['did:test:foo'],
      });
    });
  });
});
