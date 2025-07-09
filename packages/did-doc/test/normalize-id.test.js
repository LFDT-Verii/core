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

const {
  normalizeOrganizationDidDocService,
  normalizeDidDoc,
  toDidUrl,
} = require('../src/normalize-id');

describe('Normalization test suite', () => {
  it('Should normalize a service with an id that is a full did plus a fragment', async () => {
    const service = {
      id: 'did:ion:123#id-1',
      type: 'LinkedDocument',
      serviceEndpoint: 'https://agent.samplevendor.com/acme',
    };

    const normalizedService = normalizeOrganizationDidDocService(service);
    expect(normalizedService).toEqual({
      ...service,
      id: '#id-1',
    });
  });
  it('Should normalize a service with an id that is a just a hashtagged fragment', async () => {
    const service = {
      id: '#id-1',
      type: 'LinkedDocument',
      serviceEndpoint: 'https://agent.samplevendor.com/acme',
    };

    const normalizedService = normalizeOrganizationDidDocService(service);
    expect(normalizedService).toEqual({
      ...service,
    });
  });
  it('Should normalize a service with an id that is a just a non-hashtagged fragment', async () => {
    const service = {
      id: 'id-1',
      type: 'LinkedDocument',
      serviceEndpoint: 'https://agent.samplevendor.com/acme',
    };

    const normalizedService = normalizeOrganizationDidDocService(service);
    expect(normalizedService).toEqual({
      ...service,
      id: '#id-1',
    });
  });
  it('Should normalize services within a didDoc properly', async () => {
    const service = {
      id: 'did:ion:123#id-1',
      type: 'LinkedDocument',
      serviceEndpoint: 'https://agent.samplevendor.com/acme',
    };
    const didDoc = {
      service: [service],
    };

    const normalizedDidDoc = normalizeDidDoc(didDoc);
    expect(normalizedDidDoc).toEqual({
      service: [
        {
          ...service,
          id: '#id-1',
        },
      ],
    });
  });
  it('should create a full id', () => {
    expect(toDidUrl(null, null)).toEqual('');
    expect(toDidUrl('', null)).toEqual('');
    expect(toDidUrl('', '')).toEqual('#');
    expect(toDidUrl('did:ion:123', '#blah')).toEqual('did:ion:123#blah');
    expect(toDidUrl('did:ion:456', '#blah')).toEqual('did:ion:456#blah');
    expect(toDidUrl('did:ion:789#', '#blah')).toEqual('did:ion:789##blah');
    expect(toDidUrl('did:ion:789', 'did:ion:456#blah')).toEqual(
      'did:ion:456#blah'
    );
  });
});
