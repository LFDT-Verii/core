const {
  didServiceSchema,
  addressSchema,
  locationSchema,
  organizationProfileBaseSchema,
  organizationProfileSchema,
  modifyDidServiceSchema,
  pageQuerySchema,
} = require('@verii/common-schemas');
const { CredentialTypesPlugin } = require('./plugins');
const {
  createDidServiceSchema,
  addKeyBodySchema,
  organizationIdsSchema,
  organizationRegistryServiceResponseSchema,
  fullOrganizationSchema,
  organizationProfileCreationSchema,
  organizationKybProfileCreationSchema,
  organizationProfileUpdateSchema,
  organizationSearchQueryParamsSchema,
  organizationSearchQueryProfileParamsSchema,
  organizationProfileVerifiableCredentialSchema,
  organizationVerifiedProfileSchema,
  didKeySchema,
  organizationServiceSchema,
} = require('./schemas');
const {
  publicKeySchema,
  didProofSchema,
  didDocSchema,
} = require('../resolve-did/schemas');

module.exports = async (fastify) => {
  fastify
    .addSchema(pageQuerySchema)
    .addSchema(publicKeySchema)
    .addSchema(didProofSchema)
    .addSchema(didServiceSchema)
    .addSchema(fullOrganizationSchema)
    .addSchema(organizationServiceSchema)
    .addSchema(organizationRegistryServiceResponseSchema)
    .addSchema(addressSchema)
    .addSchema(locationSchema)
    .addSchema(organizationProfileBaseSchema)
    .addSchema(organizationProfileCreationSchema)
    .addSchema(organizationKybProfileCreationSchema)
    .addSchema(organizationProfileUpdateSchema)
    .addSchema(organizationProfileSchema)
    .addSchema(didDocSchema)
    .addSchema(organizationSearchQueryParamsSchema)
    .addSchema(organizationSearchQueryProfileParamsSchema)
    .addSchema(organizationProfileVerifiableCredentialSchema)
    .addSchema(organizationVerifiedProfileSchema)
    .addSchema(addKeyBodySchema)
    .addSchema(organizationIdsSchema)
    .addSchema(createDidServiceSchema)
    .addSchema(modifyDidServiceSchema)
    .addSchema(didKeySchema)
    .autoSchemaPreset({ tags: ['registrar_organizations'] })
    .register(CredentialTypesPlugin)
    .register(
      // eslint-disable-next-line import/no-dynamic-require
      require(fastify.config.kmsPluginModule)[fastify.config.kmsPlugin]
    );
};
