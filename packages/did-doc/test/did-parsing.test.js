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
  splitDidUrlWithFragment,
  stripFragmentFromDidUrl,
  isDidUrlWithFragment,
} = require('../src/did-parsing');

describe('Did functions test suite', () => {
  describe('is did with service fragment test suite', () => {
    it('should be false when input is not a did with a service fragment', () => {
      const resultWhenInputUndefined = isDidUrlWithFragment();
      expect(resultWhenInputUndefined).toEqual(false);
      const resultWhenInputIsNotString = isDidUrlWithFragment(1);
      expect(resultWhenInputIsNotString).toEqual(false);
      const resultWhenInputIsDidWithoutServiceFragment =
        isDidUrlWithFragment('did:foo:bar');
      expect(resultWhenInputIsDidWithoutServiceFragment).toEqual(false);
    });
    it('should be true when input is a did with a service fragment', () => {
      const result = isDidUrlWithFragment('did:foo:bar#foo-service');
      expect(result).toEqual(true);
    });
    it('should be true when input did contains characters: . % -', () => {
      const result = isDidUrlWithFragment('did:foo:b.ar%-bar#foo-service');
      expect(result).toEqual(true);
    });
    it('should be true when input did contains a % character', () => {
      const result = isDidUrlWithFragment('did:foo:bar.bar%3A1234#foo-service');
      expect(result).toEqual(true);
    });
  });

  describe('split did and service fragment test suite', () => {
    it('Should throw an error when did is malformed', () => {
      const result = () => splitDidUrlWithFragment('did:foo');
      expect(result).toThrow('malformed_did_with_service_fragment');
    });

    it('should properly split a did with a service fragment', () => {
      const result = splitDidUrlWithFragment('did:foo:bar#foo-service');
      expect(result).toEqual(['did:foo:bar', '#foo-service']);
    });
  });

  describe('strip service fragment test suite', () => {
    it('Should throw an error when did is malformed', () => {
      const result = () => stripFragmentFromDidUrl('did:foo');
      expect(result).toThrow('malformed_did_with_service_fragment');
    });

    it('should properly strip a service fragment from a did', () => {
      const result = stripFragmentFromDidUrl('did:foo:bar#foo-service');
      expect(result).toEqual('did:foo:bar');
    });
  });
});
