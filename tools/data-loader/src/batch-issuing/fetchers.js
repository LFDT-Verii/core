const { env } = require('node:process');
const { initHttpClient } = require('@verii/http-client');
const { map, isEmpty } = require('lodash/fp');
const { printInfo } = require('../helpers/common');

const setupHttpClient = ({ endpoint, authToken }) => {
  const options = {};
  if (endpoint != null) {
    options.prefixUrl = `${endpoint}/operator-api/v0.8`;
  }
  if (authToken != null) {
    options.bearerToken = authToken;
  }
  if (env.NODE_TLS_REJECT_UNAUTHORIZED === '0') {
    options.tlsRejectUnauthorized = false;
  }
  if (env.NODE_ENV === 'test') {
    options.isTest = true;
  }

  return initHttpClient(options)({
    log: console,
    traceId: 'TRACE-ID',
  });
};

const initFetchers = (options) => {
  const credentialAgentTenantClient = setupHttpClient(options);
  const param = getTenantsRouteParam(options);
  return {
    getTenant: async () => {
      printInfo('Retrieving tenant');
      return credentialAgentTenantClient
        .get(`tenants/${param}`)
        .then((res) => res.json());
    },
    createDisclosure: async (disclosureRequest) => {
      printInfo('Creating disclosure');
      return credentialAgentTenantClient
        .post(`tenants/${param}/disclosures`, {
          json: disclosureRequest,
        })
        .then((res) => res.json());
    },
    getDisclosureList: async (vendorEndpoints) => {
      printInfo('Retrieving disclosure list');
      const searchParams = new URLSearchParams();
      if (!isEmpty(vendorEndpoints)) {
        vendorEndpoints.forEach((vendorEndpoint) => {
          searchParams.append('vendorEndpoint', vendorEndpoint);
        });
      }

      return credentialAgentTenantClient
        .get(`tenants/${param}/disclosures`, { searchParams })
        .then((res) => res.json());
    },
    getDisclosure: async (disclosureId) => {
      printInfo('Retrieving disclosure');
      return credentialAgentTenantClient
        .get(`tenants/${param}/disclosures/${disclosureId}`)
        .then((res) => res.json());
    },
    createOfferExchange: async (newExchange) => {
      printInfo('Creating exchange');
      return credentialAgentTenantClient
        .post(`tenants/${param}/exchanges`, {
          json: newExchange,
        })
        .then((res) => res.json());
    },
    createOffer: async (exchange, newOffer) => {
      printInfo(
        `Adding offer ${newOffer.offerId} to exchange id: ${exchange.id}`,
      );
      return credentialAgentTenantClient
        .post(`tenants/${param}/exchanges/${exchange.id}/offers`, {
          json: newOffer,
        })
        .then((res) => res.json());
    },
    submitCompleteOffer: async (exchange, offers) => {
      printInfo(
        `Completing exchange id: ${exchange.id} with offers ${map(
          'id',
          offers,
        )}`,
      );
      return credentialAgentTenantClient
        .post(`tenants/${param}/exchanges/${exchange.id}/offers/complete`)
        .then((res) => res.json());
    },
    loadExchangeQrcode: async (exchange) =>
      Buffer.from(
        await (
          await credentialAgentTenantClient.get(
            `tenants/${param}/exchanges/${exchange.id}/qrcode.png`,
          )
        ).rawBody.arrayBuffer(),
      ),
    loadExchangeDeeplink: async (exchange) =>
      credentialAgentTenantClient
        .get(`tenants/${param}/exchanges/${exchange.id}/qrcode.uri`)
        .then((res) => res.text()),
    loadDisclosureQrcode: async (disclosure) =>
      Buffer.from(
        await (
          await credentialAgentTenantClient.get(
            `tenants/${param}/disclosures/${disclosure.id}/qrcode.png`,
          )
        ).rawBody.arrayBuffer(),
      ),
    loadDisclosureDeeplink: async (disclosure) =>
      credentialAgentTenantClient
        .get(`tenants/${param}/disclosures/${disclosure.id}/qrcode.uri`)
        .then((res) => res.text()),
  };
};

const getTenantsRouteParam = (options) => options.tenant ?? options.did;
module.exports = {
  initFetchers,
};
