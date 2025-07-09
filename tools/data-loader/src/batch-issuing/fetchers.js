const { env } = require('node:process');
const got = require('got');
const { map, isEmpty } = require('lodash/fp');
const { printInfo } = require('../helpers/common');

const setupGot = ({ endpoint, authToken }) => {
  const options = {};
  if (endpoint != null) {
    options.prefixUrl = `${endpoint}/operator-api/v0.8`;
  }
  if (authToken != null) {
    options.headers = { Authorization: `Bearer ${authToken}` };
  }
  if (env.NODE_TLS_REJECT_UNAUTHORIZED === '0') {
    options.https = {
      rejectUnauthorized: false,
    };
  }
  return got.extend(options);
};

const initFetchers = (options) => {
  const credentialAgentTenantGot = setupGot(options);
  const param = getTenantsRouteParam(options);
  return {
    getTenant: async () => {
      printInfo('Retrieving tenant');
      return credentialAgentTenantGot.get(`tenants/${param}`).json();
    },
    createDisclosure: async (disclosureRequest) => {
      printInfo('Creating disclosure');
      return credentialAgentTenantGot
        .post(`tenants/${param}/disclosures`, {
          json: disclosureRequest,
        })
        .json();
    },
    getDisclosureList: async (vendorEndpoints) => {
      printInfo('Retrieving disclosure list');
      const url = new URL(
        `tenants/${param}/disclosures`,
        credentialAgentTenantGot.defaults.options.prefixUrl
      );

      if (!isEmpty(vendorEndpoints)) {
        vendorEndpoints.forEach((vendorEndpoint) => {
          url.searchParams.append('vendorEndpoint', vendorEndpoint);
        });
      }

      return credentialAgentTenantGot.get(url).json();
    },
    getDisclosure: async (disclosureId) => {
      printInfo('Retrieving disclosure');
      return credentialAgentTenantGot
        .get(`tenants/${param}/disclosures/${disclosureId}`)
        .json();
    },
    createOfferExchange: async (newExchange) => {
      printInfo('Creating exchange');
      return credentialAgentTenantGot
        .post(`tenants/${param}/exchanges`, {
          json: newExchange,
        })
        .json();
    },
    createOffer: async (exchange, newOffer) => {
      printInfo(
        `Adding offer ${newOffer.offerId} to exchange id: ${exchange.id}`
      );
      return credentialAgentTenantGot
        .post(`tenants/${param}/exchanges/${exchange.id}/offers`, {
          json: newOffer,
        })
        .json();
    },
    submitCompleteOffer: async (exchange, offers) => {
      printInfo(
        `Completing exchange id: ${exchange.id} with offers ${map(
          'id',
          offers
        )}`
      );
      return credentialAgentTenantGot
        .post(`tenants/${param}/exchanges/${exchange.id}/offers/complete`)
        .json();
    },
    loadExchangeQrcode: async (exchange) =>
      (
        await credentialAgentTenantGot.get(
          `tenants/${param}/exchanges/${exchange.id}/qrcode.png`
        )
      ).rawBody,
    loadExchangeDeeplink: async (exchange) =>
      credentialAgentTenantGot
        .get(`tenants/${param}/exchanges/${exchange.id}/qrcode.uri`)
        .text(),
    loadDisclosureQrcode: async (disclosure) =>
      (
        await credentialAgentTenantGot.get(
          `tenants/${param}/disclosures/${disclosure.id}/qrcode.png`
        )
      ).rawBody,
    loadDisclosureDeeplink: async (disclosure) =>
      credentialAgentTenantGot
        .get(`tenants/${param}/disclosures/${disclosure.id}/qrcode.uri`)
        .text(),
  };
};

const getTenantsRouteParam = (options) => options.tenant ?? options.did;
module.exports = {
  initFetchers,
};
