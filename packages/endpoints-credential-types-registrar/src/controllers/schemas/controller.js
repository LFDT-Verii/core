const { map, omit, trim } = require('lodash/fp');
const { normalizeJsonSchemaName } = require('@verii/common-functions');
const { fetchJson } = require('@verii/common-fetchers');
const { initLoadSchemaValidate } = require('../../entities');
const { CachingConstants } = require('../../helpers');

const schemasController = async (fastify) => {
  const loadSchemaValidateFn = initLoadSchemaValidate(fastify);

  fastify
    .autoSchemaPreset({
      tags: ['registrar_credential_types'],
    })
    .get(
      '/:schemaName',
      {
        schema: fastify.autoSchema({
          params: {
            type: 'object',
            properties: { schemaName: { type: 'string' } },
          },
          response: { 200: { type: 'object', additionalProperties: true } },
        }),
      },
      async (req, reply) => {
        const {
          repos,
          params: { schemaName: rawSchemaName },
        } = req;
        const schemaName = normalizeJsonSchemaName(rawSchemaName);

        const { schemaUrl } =
          await repos.credentialSchemas.findCredentialTypeMetadataBySchemaName(
            schemaName,
          );
        reply.header(
          CachingConstants.CACHE_CONTROL_HEADER,
          CachingConstants.MAX_AGE_CACHE_CONTROL,
        );
        const json = await fetchJson(schemaUrl, req);
        return reply.type('application/json; charset=UTF-8').send(json);
      },
    )
    // replace with calls to `get-credential-type-descriptors`
    .get(
      '/get-uri',
      {
        deprecated: true,
        schema: fastify.autoSchema({
          query: {
            type: 'object',
            properties: {
              credentialTypes: {
                type: 'array',
                items: { type: 'string' },
              },
            },
          },
          response: {
            200: {
              type: 'object',
              properties: {
                schemaFileNames: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      id: { type: 'string' },
                      credentialType: { type: 'string' },
                      schemaName: { type: 'string' },
                    },
                  },
                },
              },
            },
          },
        }),
      },
      async (req, reply) => {
        const {
          repos: { credentialSchemas: credentialSchemasRepo },
          query: { credentialTypes },
        } = req;
        const schemaNames = await credentialSchemasRepo.find({
          filter: {
            credentialType: {
              $in: credentialTypes,
            },
          },
        });
        const schemaFileNames = map(({ schemaUrl, credentialType }) => ({
          id: schemaUrl,
          credentialType,
        }))(schemaNames);

        return reply
          .header(
            CachingConstants.CACHE_CONTROL_HEADER,
            CachingConstants.MAX_AGE_CACHE_CONTROL,
          )
          .send({ schemaFileNames });
      },
    )
    .post(
      '/:schemaName/validate',
      {
        schema: fastify.autoSchema({
          params: {
            type: 'object',
            properties: { schemaName: { type: 'string' } },
          },
          response: {
            200: {
              type: 'object',
              properties: {
                valid: { type: 'boolean' },
                errors: { type: 'array', items: { type: 'string' } },
              },
            },
            ...fastify.BadRequestResponse,
          },
        }),
      },
      async (req, reply) => {
        const {
          params: { schemaName },
          body,
        } = req;

        const validate = await loadSchemaValidateFn(schemaName, req);
        const valid = validate(omit(['vendorUserId'], body));
        if (!valid) {
          reply.code(400);
          return {
            valid: false,
            errors: convertErrors(validate.errors),
          };
        }

        return { valid: true };
      },
    );
};

const convertErrors = map((e) => trim(`${e.instancePath} ${e.message}`));

module.exports = schemasController;
