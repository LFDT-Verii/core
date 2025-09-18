import { describe, it } from 'node:test';
import { expect } from 'expect';
import { CREDENTIAL_TYPES_IDS } from '@/utils/serviceTypes.js';
import { buildPayload } from '../buildPayload.js';

describe('buildPayload', () => {
  const mockDid = 'did:example:123';
  const mockServices = [
    { id: 'did:example:123#vlc-web-wallet-provider-1' },
    { id: 'did:example:123#vlc-holder-app-provider-1' },
  ];

  describe('generic service payload', () => {
    it('should build basic payload without did and services', () => {
      const service = {
        serviceEndpoint: 'https://example.com/service',
      };
      const type = 'GenericService_v1';

      const result = buildPayload(service, type);

      expect(result).toEqual({
        serviceEndpoint: 'https://example.com/service',
        type: 'GenericService_v1',
      });
    });

    it('should build basic payload with did and services', () => {
      const service = {
        serviceEndpoint: 'https://example.com/service',
      };
      const type = 'GenericService_v1';

      const result = buildPayload(service, type, mockDid, mockServices);

      expect(result).toEqual({
        id: 'did:example:123#generic-service-v-1-1',
        serviceEndpoint: 'https://example.com/service',
        type: 'GenericService_v1',
      });
    });
  });

  describe('VLC_WEB_WALLET_PROVIDER', () => {
    it('should build web wallet payload with all fields', () => {
      const service = {
        serviceEndpoint: 'https://example.com/wallet',
        logo: 'https://example.com/logo.png',
        name: 'Example Wallet',
        supportedExchangeProtocols: ['VN_API', 'OPENID4VC'],
      };
      const type = CREDENTIAL_TYPES_IDS.VLC_WEB_WALLET_PROVIDER;

      const result = buildPayload(service, type);

      expect(result).toEqual({
        serviceEndpoint: 'https://example.com/wallet',
        type: 'VlcWebWalletProvider_v1',
        logoUrl: 'https://example.com/logo.png',
        name: 'Example Wallet',
        supportedExchangeProtocols: ['VN_API', 'OPENID4VC'],
      });
    });

    it('should build web wallet payload with did and services', () => {
      const service = {
        serviceEndpoint: 'https://example.com/wallet',
        logo: 'https://example.com/logo.png',
        name: 'Example Wallet',
        supportedExchangeProtocols: ['VN_API', 'OPENID4VC'],
      };
      const type = CREDENTIAL_TYPES_IDS.VLC_WEB_WALLET_PROVIDER;

      const result = buildPayload(service, type, mockDid, mockServices);

      expect(result).toEqual({
        id: 'did:example:123#vlc-web-wallet-provider-v-1-1',
        serviceEndpoint: 'https://example.com/wallet',
        type: 'VlcWebWalletProvider_v1',
        logoUrl: 'https://example.com/logo.png',
        name: 'Example Wallet',
        supportedExchangeProtocols: ['VN_API', 'OPENID4VC'],
      });
    });
  });

  describe('VLC_HOLDER_APP_PROVIDER', () => {
    it('should build holder app payload with all fields', () => {
      const service = {
        serviceEndpoint: 'https://example.com/app',
        logo: 'https://example.com/logo.png',
        name: 'Example App',
        supportedExchangeProtocols: ['VN_API', 'OPENID4VC'],
        playStoreUrl: 'https://play.google.com/store/apps/details?id=com.example',
        googlePlayId: 'com.example',
        appleAppStoreUrl: 'https://apps.apple.com/app/example/id123456789',
        appleAppId: '123456789',
      };
      const type = CREDENTIAL_TYPES_IDS.VLC_HOLDER_APP_PROVIDER;

      const result = buildPayload(service, type);

      expect(result).toEqual({
        serviceEndpoint: 'https://example.com/app',
        type: 'VlcHolderAppProvider_v1',
        logoUrl: 'https://example.com/logo.png',
        name: 'Example App',
        supportedExchangeProtocols: ['VN_API', 'OPENID4VC'],
        playStoreUrl: 'https://play.google.com/store/apps/details?id=com.example',
        googlePlayId: 'com.example',
        appleAppStoreUrl: 'https://apps.apple.com/app/example/id123456789',
        appleAppId: '123456789',
      });
    });

    it('should build holder app payload with did and services', () => {
      const service = {
        serviceEndpoint: 'https://example.com/app',
        logo: 'https://example.com/logo.png',
        name: 'Example App',
        appleAppStoreUrl: 'https://apps.apple.com/app/example/id123456789',
        appleAppId: '123456789',
        supportedExchangeProtocols: ['VN_API', 'OPENID4VC'],
      };
      const type = CREDENTIAL_TYPES_IDS.VLC_HOLDER_APP_PROVIDER;

      const result = buildPayload(service, type, mockDid, mockServices);

      expect(result).toEqual({
        id: 'did:example:123#vlc-holder-app-provider-v-1-1',
        serviceEndpoint: 'https://example.com/app',
        type: 'VlcHolderAppProvider_v1',
        logoUrl: 'https://example.com/logo.png',
        name: 'Example App',
        appleAppStoreUrl: 'https://apps.apple.com/app/example/id123456789',
        appleAppId: '123456789',
        supportedExchangeProtocols: ['VN_API', 'OPENID4VC'],
      });
    });
  });

  describe('ID generation with getNewServiceIndex', () => {
    it('should generate id with index 1 for first service of type', () => {
      const service = {
        serviceEndpoint: 'https://example.com/service',
      };
      const type = 'TestService_v1';
      const emptyServices = [];

      const result = buildPayload(service, type, mockDid, emptyServices);

      expect(result).toEqual({
        id: 'did:example:123#test-service-v-1-1',
        serviceEndpoint: 'https://example.com/service',
        type: 'TestService_v1',
      });
    });

    it('should increment index for existing services of same type', () => {
      const service = {
        serviceEndpoint: 'https://example.com/service',
      };
      const type = 'TestService_v1';
      const servicesWithExisting = [
        { id: 'did:example:123#test-service-v-1-1' },
        { id: 'did:example:123#test-service-v-1-2' },
        { id: 'did:example:123#other-service-1' },
      ];

      const result = buildPayload(service, type, mockDid, servicesWithExisting);

      expect(result).toEqual({
        id: 'did:example:123#test-service-v-1-3',
        serviceEndpoint: 'https://example.com/service',
        type: 'TestService_v1',
      });
    });

    it('should handle mixed service types correctly', () => {
      const service = {
        serviceEndpoint: 'https://example.com/wallet',
      };
      const type = 'VlcWebWalletProvider_v1';
      const mixedServices = [
        { id: 'did:example:123#vlc-web-wallet-provider-v-1-1' },
        { id: 'did:example:123#vlc-holder-app-provider-v-1-1' },
        { id: 'did:example:123#vlc-web-wallet-provider-v-1-2' },
        { id: 'did:example:123#vlc-credential-agent-operator-v-1-1' },
      ];

      const result = buildPayload(service, type, mockDid, mixedServices);

      expect(result).toEqual({
        id: 'did:example:123#vlc-web-wallet-provider-v-1-3',
        serviceEndpoint: 'https://example.com/wallet',
        type: 'VlcWebWalletProvider_v1',
      });
    });

    it('should not generate id when services array is missing', () => {
      const service = {
        serviceEndpoint: 'https://example.com/service',
      };
      const type = 'TestService_v1';

      const result = buildPayload(service, type, mockDid, null);

      expect(result).toEqual({
        serviceEndpoint: 'https://example.com/service',
        type: 'TestService_v1',
      });
      expect(result.id).toBeUndefined();
    });

    it('should handle empty services array', () => {
      const service = {
        serviceEndpoint: 'https://example.com/service',
      };
      const type = 'TestService_v1';
      const emptyServices = [];

      const result = buildPayload(service, type, mockDid, emptyServices);

      expect(result).toEqual({
        id: 'did:example:123#test-service-v-1-1',
        serviceEndpoint: 'https://example.com/service',
        type: 'TestService_v1',
      });
    });
  });
});
