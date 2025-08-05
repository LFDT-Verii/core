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

// eslint-disable-next-line import/order

const { after, before, describe, it } = require('node:test');
const { expect } = require('expect');

const console = require('console');
const {
  mongoFactoryWrapper,
  mongoCloseWrapper,
} = require('@verii/tests-helpers');
const { env: config } = require('@spencejs/spence-config');
const {
  setConfigurationType,
} = require('../../src/entities/disclosures/repos/set-configuration-type');
const { VendorEndpoint } = require('../../src/entities');

describe('setConfigurationType tests suite', () => {
  before(async () => {
    await mongoFactoryWrapper('test-set-configuration-type-modifier', {
      log: console,
      config,
    });
  });

  after(async () => {
    await mongoCloseWrapper();
  });

  it('should set right configuration type', (t) => {
    const extension = setConfigurationType({
      prepModification: t.mock.fn((x) => x),
    });
    expect(extension.prepModification({}, 'insert')).toEqual({}, 'insert');
    expect(
      extension.prepModification(
        {
          vendorEndpoint: VendorEndpoint.RECEIVE_APPLICANT,
        },
        'insert'
      )
    ).toEqual(
      {
        configurationType: 'inspection',
        vendorEndpoint: VendorEndpoint.RECEIVE_APPLICANT,
      },
      'insert'
    );
    expect(
      extension.prepModification(
        {
          vendorEndpoint: VendorEndpoint.ISSUING_IDENTIFICATION,
        },
        'update'
      )
    ).toEqual(
      {
        configurationType: 'issuing',
        vendorEndpoint: VendorEndpoint.ISSUING_IDENTIFICATION,
      },
      'update'
    );
  });
});
