const {
  endsWith,
  filter,
  flow,
  includes,
  map,
  isEmpty,
  set,
} = require('lodash/fp');
const {
  ServiceTypes,
  ServiceTypesOfServiceCategory,
  ServiceCategories,
} = require('@verii/organizations-registry');
const { isDidUrlWithFragment } = require('@verii/did-doc');
const { buildPublicServices } = require('./build-public-services');
const { normalizeServiceEndpoint } = require('./normalize-service-endpoint');

const transformServiceEndpoint = (service, caoServiceRefs) => {
  if (!isDidUrlWithFragment(service.serviceEndpoint)) {
    return service;
  }
  const caoServiceRef = caoServiceRefs[service.serviceEndpoint];
  if (caoServiceRef?.caoService == null) {
    return service;
  }
  return set(
    'serviceEndpoint',
    caoServiceRef.caoService.serviceEndpoint,
    service
  );
};

const transformProfileService = (
  organization,
  services,
  serviceTypes,
  caoServiceRefs,
  { query }
) => {
  const pipeline = [
    buildPublicServices,
    filter((service) => includes(service.id, organization.activatedServiceIds)),
  ];
  if (!isEmpty(serviceTypes)) {
    pipeline.push(filter((service) => includes(service.type, serviceTypes)));
  }
  if (!query.noServiceEndpointTransform) {
    pipeline.push(
      map((service) => transformServiceEndpoint(service, caoServiceRefs))
    );
    const convertIssuerService = convertIssuer(organization.didDoc);
    pipeline.push(map((service) => convertIssuerService(service)));
  }

  return flow(pipeline)(services);
};

const isLegacyIssuerService = (service) =>
  [
    ServiceTypes.IdDocumentIssuerType,
    ServiceTypes.NotaryIdDocumentIssuerType,
    ServiceTypes.ContactIssuerType,
    ServiceTypes.NotaryContactIssuerType,
    ServiceTypes.WorkPermitIssuerType,
    ServiceTypes.NotaryWorkPermitIssuerType,
    ServiceTypes.NotaryIssuerType,
    ServiceTypes.IdentityIssuerType,
    ...ServiceTypesOfServiceCategory[ServiceCategories.Issuer],
  ].includes(service.type) &&
  !endsWith('get-credential-manifest', service.serviceEndpoint);

const convertIssuer = (didDoc) => (service) => {
  const normalizedEndpoint = normalizeServiceEndpoint(service.serviceEndpoint);
  if (
    isDidUrlWithFragment(service.serviceEndpoint) ||
    !isLegacyIssuerService(service)
  ) {
    return {
      ...service,
      serviceEndpoint: normalizedEndpoint,
    };
  }
  return {
    ...service,
    serviceEndpoint: `${normalizedEndpoint}/api/holder/v0.6/org/${didDoc.id}/issue/get-credential-manifest`,
  };
};

module.exports = { transformProfileService, convertIssuer };
