/**
 * Created by Michael Avoyan on 14/07/2024.
 *
 * Copyright 2022 Velocity Career Labs inc.
 * SPDX-License-Identifier: Apache-2.0
 */

export default async function initializationRoutes(fastify) {
  fastify.get('/getCountries', (req, reply) => {
    try {
      reply.send(req.vclSdk.countries);
    } catch (error: any) {
      reply.status(error.statusCode ?? 500).send(error);
    }
  });
  fastify.get('/getCredentialTypes', (req, reply) => {
    try {
      reply.send(req.vclSdk.credentialTypes);
    } catch (error: any) {
      reply.status(error.statusCode ?? 500).send(error);
    }
  });
  fastify.get('/getCredentialTypeSchemas', (req, reply) => {
    try {
      reply.send(req.vclSdk.credentialTypeSchemas);
    } catch (error: any) {
      reply.status(error.statusCode ?? 500).send(error);
    }
  });
}
