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

const path = require('path');
const { afterEach, describe, it } = require('node:test');
const { expect } = require('expect');
const { loadTestEnv } = require('@verii/tests-helpers');

loadTestEnv(path.resolve(__dirname, 'helpers/.env.test'));

const { forEach, pick } = require('lodash/fp');
const { createConfig } = require('../src/config/config');
const {
  activateServices,
  getSubjectNetPrefix,
  initOrganizationRegistrarEmails,
} = require('../src/entities');
const packageJson = require('../package.json');

const settingKeys = [
  'environmentLabel',
  'networkName',
  'networkNameInEmailSubjects',
  'validateKybProfile',
  'autoActivateServices',
];

const settingVariables = [
  'REGISTRAR_NETWORK_NAME',
  'REGISTRAR_NETWORK_NAME_IN_EMAIL_SUBJECTS',
  'REGISTRAR_VALIDATE_KYB_PROFILE',
  'REGISTRAR_AUTO_ACTIVATE_SERVICES',
];

describe('Registrar settings that differ between deployments', () => {
  describe('config', () => {
    afterEach(() => {
      forEach((variable) => {
        delete process.env[variable];
      }, settingVariables);
    });

    it('should default each setting to what NODE_ENV=test gave it', () => {
      expect(pick(settingKeys, createConfig(packageJson))).toEqual({
        environmentLabel: 'test',
        networkName: 'LocalDevNet',
        networkNameInEmailSubjects: true,
        validateKybProfile: false,
        autoActivateServices: true,
      });
    });

    it('should read each setting', () => {
      process.env.REGISTRAR_NETWORK_NAME = 'MainNet';
      process.env.REGISTRAR_NETWORK_NAME_IN_EMAIL_SUBJECTS = 'false';
      process.env.REGISTRAR_VALIDATE_KYB_PROFILE = 'true';
      process.env.REGISTRAR_AUTO_ACTIVATE_SERVICES = 'false';
      expect(pick(settingKeys, createConfig(packageJson))).toEqual({
        environmentLabel: 'test',
        networkName: 'MainNet',
        networkNameInEmailSubjects: false,
        validateKybProfile: true,
        autoActivateServices: false,
      });
    });
  });

  describe('activateServices', () => {
    const services = [{ id: '#service-1' }, { id: '#service-2' }];
    const activate = (autoActivateServices, headers = {}) =>
      activateServices('did:ion:1', services, {
        headers,
        config: { autoActivateServices },
      });

    it('should activate the services when autoActivateServices is on', () => {
      expect(activate(true)).toEqual(['#service-1', '#service-2']);
      expect(activate(true, { 'x-auto-activate': '1' })).toEqual([
        '#service-1',
        '#service-2',
      ]);
    });

    it('should not activate the services when x-auto-activate is 0', () => {
      expect(activate(true, { 'x-auto-activate': '0' })).toEqual([]);
    });

    it('should not activate the services when autoActivateServices is off', () => {
      expect(activate(false)).toEqual([]);
      expect(activate(false, { 'x-auto-activate': '1' })).toEqual([]);
    });
  });

  describe('getSubjectNetPrefix', () => {
    it('should start subjects with the network name when networkNameInEmailSubjects is on', () => {
      expect(
        getSubjectNetPrefix({
          networkName: 'DevNet',
          networkNameInEmailSubjects: true,
        }),
      ).toEqual('DevNet: ');
    });

    it('should leave subjects alone when networkNameInEmailSubjects is off', () => {
      expect(
        getSubjectNetPrefix({
          networkName: 'MainNet',
          networkNameInEmailSubjects: false,
        }),
      ).toEqual('');
    });
  });

  describe('registrar emails', () => {
    const emails = initOrganizationRegistrarEmails({
      environmentLabel: 'testnet',
      networkName: 'ExampleNet',
      registrarSupportEmail: 'support@localhost.test',
      noReplyEmail: 'no-reply@localhost.test',
      tokenWalletBaseUrl: 'https://wallet.localhost.test',
    });
    const organization = {
      profile: { name: 'Example Org' },
      didDoc: { id: 'did:ion:1' },
    };

    it('should name the network from networkName', () => {
      const email = emails.emailToRegisteredOrgForServicesActivated({
        organization,
        activatedServiceIds: ['#service-1'],
        emails: ['admin@localhost.test'],
      });
      expect(email.subject).toEqual(
        'Velocity Services Activated on ExampleNet',
      );
      expect(email.message).toContain(
        'admin of Example Org on Velocity Network ExampleNet',
      );
    });

    it('should start support subjects with the environment label', () => {
      const email = emails.emailToSupportForServicesAddedAndNeedActivation(
        { organization, addedServices: [] },
        { headers: { 'user-agent': 'test' } },
      );
      expect(email.subject).toEqual(
        'TESTNET: Velocity Services Activation Required',
      );
    });
  });
});
