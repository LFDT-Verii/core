const { isEmpty, map, omit } = require('lodash/fp');
const newError = require('http-errors');
const {
  repoFactory,
  autoboxIdsExtension,
} = require('@spencejs/spence-mongo-repos');
const {
  deletedExtension,
} = require('@verii/spencer-mongo-extensions');
const {
  searchByAggregationExtension,
} = require('./search-by-aggregation-extension');
const { OrganizationErrorMessages } = require('../domains');
const { transformDidFilter } = require('./transform-did-filter');
const { findCaosExtension } = require('./find-caos-extension');

const defaultProjection = {
  _id: 1,
  didDoc: 1,
  profile: 1,
  services: 1,
  activatedServiceIds: 1,
  verifiableCredentialJwt: 1,
  adminEmail: 1,
  normalizedProfileName: 1,
  didNotCustodied: 1,
  invitationId: 1,
  ids: 1,
  updatedAt: 1,
  createdAt: 1,
};

module.exports = (app, options, next = () => {}) => {
  next();
  return repoFactory(
    {
      name: 'organizations',
      entityName: 'organization',
      defaultProjection,
      extensions: [
        autoboxIdsExtension,
        scopeFilterExtension,
        findersExtension,
        servicesExtensions,
        deletedExtension(),
        searchByAggregationExtension,
        findCaosExtension,
      ],
    },
    app
  );
};
const servicesExtensions = (parent) => ({
  prepModification: (organization, kind) => {
    if (kind !== 'insert') {
      return parent.prepModification(organization, kind);
    }
    const now = new Date();
    const services = map((service) => {
      return {
        ...service,
        createdAt: now,
        updatedAt: now,
      };
    }, organization.services);

    return parent.prepModification({ ...organization, services }, kind);
  },
  addService: async (organizationId, service) => {
    const addedService = {
      ...service,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    await parent.collection().updateOne(
      { _id: organizationId },
      {
        $push: {
          services: addedService,
        },
      }
    );
    return addedService;
  },
  updateService: async (organizationId, service) => {
    const updatedService = {
      ...service,
      updatedAt: new Date(),
    };
    await parent.collection().updateOne(
      { _id: organizationId, 'services.id': service.id },
      {
        $set: {
          'services.$': updatedService,
          updatedAt: updatedService.updatedAt, // bubble up the updatedAt timestamp to the root object
        },
      }
    );

    return updatedService;
  },
});

const findersExtension = (parent) => ({
  findByDids: async (dids, ...options) =>
    parent.find(
      {
        filter: transformDidFilter({
          'didDoc.id': {
            $in: dids,
          },
        }),
      },
      ...options
    ),
  findOneByDid: async (did, ...options) => {
    const organization = await parent.findOne(
      {
        filter: transformDidFilter({
          'didDoc.id': did,
        }),
      },
      ...options
    );
    if (isEmpty(organization)) {
      throw newError(404, OrganizationErrorMessages.ORGANIZATION_NOT_FOUND, {
        errorCode: 'organization_not_found',
      });
    }
    return organization;
  },
  extensions: parent.extensions.concat(['findersExtension']),
});

const scopeFilterExtension = (parent, context) => {
  return {
    prepFilter: (filter) => {
      if (filter['@ignoreScope']) {
        return parent.prepFilter(omit(['@ignoreScope'], filter));
      }

      if (
        context.scope?.dids == null ||
        (context.scope.dids.length === 1 && context.scope.dids[0] === 'new')
      ) {
        return parent.prepFilter(filter);
      }

      return parent.prepFilter(
        transformDidFilter({
          ...filter,
          'didDoc.id': { $in: context.scope.dids },
        })
      );
    },
    extensions: parent.extensions.concat(['scopeFilterExtension']),
  };
};
