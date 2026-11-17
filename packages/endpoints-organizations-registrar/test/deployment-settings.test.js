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
const { afterEach, describe, it, mock } = require('node:test');
const { expect } = require('expect');
const { loadTestEnv } = require('@verii/tests-helpers');

const testEnvFile = path.resolve(__dirname, 'helpers/.env.test');
loadTestEnv(testEnvFile);

const { forEach, pick } = require('lodash/fp');
const veriiConfig = require('@verii/config');
const { createConfig } = require('../src/config/config');
const {
  activateServices,
  getSubjectNetPrefix,
  initOrganizationRegistrarEmails,
  whichNet,
} = require('../src/entities');
const packageJson = require('../package.json');

const settingKeys = ['network', 'validateKybProfile', 'autoActivateServices'];

// Builds the registrar config as a server with this NODE_ENV would
const createConfigUnder = (nodeEnv) => {
  const configMock = mock.module('@verii/config', {
    namedExports: {
      ...veriiConfig,
      genericConfig: {
        ...veriiConfig.genericConfig,
        nodeEnv,
        isProd: nodeEnv === 'production',
      },
    },
  });
  try {
    return pick(settingKeys, createConfig(packageJson));
  } finally {
    configMock.restore();
  }
};

const settingVariables = [
  'REGISTRAR_VALIDATE_KYB_PROFILE',
  'REGISTRAR_AUTO_ACTIVATE_SERVICES',
];

describe('Registrar settings that differ between deployments', () => {
  describe('config', () => {
    afterEach(() => {
      forEach((variable) => {
        delete process.env[variable];
      }, settingVariables);
      loadTestEnv(testEnvFile);
    });

    it('should read NETWORK and default the other settings to what NODE_ENV=test gave them', () => {
      expect(createConfigUnder('test')).toEqual({
        network: 'devnet',
        validateKybProfile: false,
        autoActivateServices: true,
      });
    });

    it('should default the other settings to what NODE_ENV=production gave them', () => {
      expect(createConfigUnder('production')).toEqual({
        network: 'devnet',
        validateKybProfile: true,
        autoActivateServices: false,
      });
    });

    it('should prefer each setting to its NODE_ENV default', () => {
      process.env.REGISTRAR_VALIDATE_KYB_PROFILE = 'false';
      process.env.REGISTRAR_AUTO_ACTIVATE_SERVICES = 'true';
      expect(createConfigUnder('production')).toEqual({
        network: 'devnet',
        validateKybProfile: false,
        autoActivateServices: true,
      });
    });

    it('should fail without NETWORK', () => {
      delete process.env.NETWORK;
      expect(() => createConfig(packageJson)).toThrow(/"NETWORK"/);
    });
  });

  describe('whichNet', () => {
    it('should give each Velocity network the name members see in emails', () => {
      expect(whichNet({ network: 'devnet' })).toEqual('DevNet');
      expect(whichNet({ network: 'testnet' })).toEqual('TestNet');
      expect(whichNet({ network: 'mainnet' })).toEqual('MainNet');
    });

    it('should show any other network as it is', () => {
      expect(whichNet({ network: 'no-preset' })).toEqual('no-preset');
      expect(whichNet({ network: 'ExampleNet' })).toEqual('ExampleNet');
    });
  });

  describe('getSubjectNetPrefix', () => {
    it('should start subjects with the network name on devnet and testnet', () => {
      expect(getSubjectNetPrefix({ network: 'devnet' })).toEqual('DevNet: ');
      expect(getSubjectNetPrefix({ network: 'testnet' })).toEqual('TestNet: ');
    });

    it('should leave subjects alone on any other network', () => {
      expect(getSubjectNetPrefix({ network: 'mainnet' })).toEqual('');
      expect(getSubjectNetPrefix({ network: 'no-preset' })).toEqual('');
      expect(getSubjectNetPrefix({ network: 'ExampleNet' })).toEqual('');
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

  describe('registrar emails', () => {
    const emails = initOrganizationRegistrarEmails({
      environmentLabel: 'TestNet',
      network: 'testnet',
      registrarSupportEmail: 'support@localhost.test',
      noReplyEmail: 'no-reply@localhost.test',
      tokenWalletBaseUrl: 'https://wallet.localhost.test',
    });
    const organization = {
      profile: { name: 'Example Org' },
      didDoc: { id: 'did:ion:1' },
    };

    it('should name the network from NETWORK', () => {
      const email = emails.emailToRegisteredOrgForServicesActivated({
        organization,
        activatedServiceIds: ['#service-1'],
        emails: ['admin@localhost.test'],
      });
      expect(email.subject).toEqual('Velocity Services Activated on TestNet');
      expect(email.message).toContain(
        'admin of Example Org on Velocity Network TestNet',
      );
    });

    it('should start support subjects with the environment label', () => {
      const email = emails.emailToSupportForServicesAddedAndNeedActivation(
        { organization, addedServices: [] },
        { headers: { 'user-agent': 'test' } },
      );
      expect(email.subject).toEqual(
        'TestNet: Velocity Services Activation Required',
      );
    });
  });
});
