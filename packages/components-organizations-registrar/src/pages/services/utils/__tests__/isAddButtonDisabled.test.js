import { describe, it } from 'node:test';
import { expect } from 'expect';

import { isAddButtonDisabled } from '../isAddButtonDisabled.js';

describe('isAddButtonDisabled', () => {
  describe('when inProgress is true', () => {
    it('should return true regardless of other parameters', () => {
      const formData = {
        serviceEndpoint: 'https://example.com',
        serviceCAO: 'cao-id',
        name: 'Test',
        logo: 'logo-url',
        supportedExchangeProtocols: ['VN_API'],
      };
      const result = isAddButtonDisabled(true, true, false, false, false, formData);
      expect(result).toBe(true);
    });
  });

  describe('when no service type is selected', () => {
    it('should return true (default case)', () => {
      const formData = { serviceEndpoint: 'https://example.com' };
      const result = isAddButtonDisabled(false, false, false, false, false, formData);
      expect(result).toBe(true);
    });
  });

  describe('isIssuingOrInspection service type', () => {
    it('should return true when serviceEndpoint is missing', () => {
      const formData = { serviceCAO: 'cao-id' };
      const result = isAddButtonDisabled(false, true, false, false, false, formData);
      expect(result).toBe(true);
    });

    it('should return true when serviceCAO is missing', () => {
      const formData = { serviceEndpoint: 'https://example.com' };
      const result = isAddButtonDisabled(false, true, false, false, false, formData);
      expect(result).toBe(true);
    });

    it('should return false when both serviceEndpoint and serviceCAO are provided', () => {
      const formData = {
        serviceEndpoint: 'https://example.com',
        serviceCAO: 'cao-id',
      };
      const result = isAddButtonDisabled(false, true, false, false, false, formData);
      expect(result).toBe(false);
    });
  });

  describe('isCAO service type', () => {
    it('should return true when serviceEndpoint is missing', () => {
      const formData = {};
      const result = isAddButtonDisabled(false, false, true, false, false, formData);
      expect(result).toBe(true);
    });

    it('should return false when serviceEndpoint is provided', () => {
      const formData = { serviceEndpoint: 'https://example.com' };
      const result = isAddButtonDisabled(false, false, true, false, false, formData);
      expect(result).toBe(false);
    });
  });

  describe('isWebWallet service type', () => {
    it('should return true when name is missing', () => {
      const formData = {
        logo: 'logo-url',
        serviceEndpoint: 'https://example.com',
        supportedExchangeProtocols: ['VN_API'],
      };
      const result = isAddButtonDisabled(false, false, false, true, false, formData);
      expect(result).toBe(true);
    });

    it('should return true when logo is missing', () => {
      const formData = {
        name: 'Test Wallet',
        serviceEndpoint: 'https://example.com',
        supportedExchangeProtocols: ['VN_API'],
      };
      const result = isAddButtonDisabled(false, false, false, true, false, formData);
      expect(result).toBe(true);
    });

    it('should return true when serviceEndpoint is missing', () => {
      const formData = {
        name: 'Test Wallet',
        logo: 'logo-url',
        supportedExchangeProtocols: ['VN_API'],
      };
      const result = isAddButtonDisabled(false, false, false, true, false, formData);
      expect(result).toBe(true);
    });

    it('should return true when supportedExchangeProtocols is missing', () => {
      const formData = {
        name: 'Test Wallet',
        logo: 'logo-url',
        serviceEndpoint: 'https://example.com',
      };
      const result = isAddButtonDisabled(false, false, false, true, false, formData);
      expect(result).toBe(true);
    });

    it('should return true when supportedExchangeProtocols is empty array', () => {
      const formData = {
        name: 'Test Wallet',
        logo: 'logo-url',
        serviceEndpoint: 'https://example.com',
        supportedExchangeProtocols: [],
      };
      const result = isAddButtonDisabled(false, false, false, true, false, formData);
      expect(result).toBe(true);
    });

    it('should return false when all required fields are provided', () => {
      const formData = {
        name: 'Test Wallet',
        logo: 'logo-url',
        serviceEndpoint: 'https://example.com',
        supportedExchangeProtocols: ['VN_API'],
      };
      const result = isAddButtonDisabled(false, false, false, true, false, formData);
      expect(result).toBe(false);
    });
  });

  describe('isHolderWallet service type', () => {
    const baseFormData = {
      name: 'Test App',
      logo: 'logo-url',
      serviceEndpoint: 'https://example.com',
      supportedExchangeProtocols: ['VN_API'],
      playStoreUrl: 'https://play.google.com/store',
      googlePlayId: 'com.example',
      appleAppStoreUrl: 'https://apps.apple.com/app',
      appleAppId: '123456789',
    };

    it('should return true when name is missing', () => {
      const formData = { ...baseFormData };
      delete formData.name;
      const result = isAddButtonDisabled(false, false, false, false, true, formData);
      expect(result).toBe(true);
    });

    it('should return true when logo is missing', () => {
      const formData = { ...baseFormData };
      delete formData.logo;
      const result = isAddButtonDisabled(false, false, false, false, true, formData);
      expect(result).toBe(true);
    });

    it('should return true when serviceEndpoint is missing', () => {
      const formData = { ...baseFormData };
      delete formData.serviceEndpoint;
      const result = isAddButtonDisabled(false, false, false, false, true, formData);
      expect(result).toBe(true);
    });

    it('should return true when supportedExchangeProtocols is missing', () => {
      const formData = { ...baseFormData };
      delete formData.supportedExchangeProtocols;
      const result = isAddButtonDisabled(false, false, false, false, true, formData);
      expect(result).toBe(true);
    });

    it('should return true when playStoreUrl is missing', () => {
      const formData = { ...baseFormData };
      delete formData.playStoreUrl;
      const result = isAddButtonDisabled(false, false, false, false, true, formData);
      expect(result).toBe(true);
    });

    it('should return true when googlePlayId is missing', () => {
      const formData = { ...baseFormData };
      delete formData.googlePlayId;
      const result = isAddButtonDisabled(false, false, false, false, true, formData);
      expect(result).toBe(true);
    });

    it('should return true when appleAppStoreUrl is missing', () => {
      const formData = { ...baseFormData };
      delete formData.appleAppStoreUrl;
      const result = isAddButtonDisabled(false, false, false, false, true, formData);
      expect(result).toBe(true);
    });

    it('should return true when appleAppId is missing', () => {
      const formData = { ...baseFormData };
      delete formData.appleAppId;
      const result = isAddButtonDisabled(false, false, false, false, true, formData);
      expect(result).toBe(true);
    });

    it('should return false when all required fields are provided', () => {
      const formData = { ...baseFormData };
      const result = isAddButtonDisabled(false, false, false, false, true, formData);
      expect(result).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('should handle empty formData object', () => {
      const formData = {};
      const result = isAddButtonDisabled(false, true, false, false, false, formData);
      expect(result).toBe(true);
    });

    it('should handle null formData', () => {
      const result = isAddButtonDisabled(false, true, false, false, false, null);
      expect(result).toBe(true);
    });

    it('should handle undefined formData', () => {
      const result = isAddButtonDisabled(false, true, false, false, false, undefined);
      expect(result).toBe(true);
    });

    it('should handle falsy values in formData', () => {
      const formData = {
        name: '',
        logo: null,
        serviceEndpoint: undefined,
        supportedExchangeProtocols: false,
      };
      const result = isAddButtonDisabled(false, false, false, true, false, formData);
      expect(result).toBe(true);
    });
  });
});
