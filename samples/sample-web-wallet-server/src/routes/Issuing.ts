/**
 * Created by Michael Avoyan on 14/07/2024.
 *
 * Copyright 2022 Velocity Career Labs inc.
 * SPDX-License-Identifier: Apache-2.0
 */
import {
  credentialManifestDescriptorFrom,
  finalizeOffersDescriptorFrom,
  generateOffersDescriptorFrom,
  tokenFrom,
} from '../utils/Converter';

export default async function issuingRoutes(fastify) {
  fastify.post('/getCredentialManifest', async (req, reply) => {
    try {
      reply.send(
        await req.vclSdk.getCredentialManifest(
          credentialManifestDescriptorFrom(req.body)
        )
      );
    } catch (error: any) {
      reply.status(error.statusCode ?? 500).send(error);
    }
  });
  fastify.post('/generateOffers', async (req, reply) => {
    try {
      reply.send(
        await req.vclSdk.generateOffers(generateOffersDescriptorFrom(req.body))
      );
    } catch (error: any) {
      reply.status(error.statusCode ?? 500).send(error);
    }
  });
  fastify.post('/checkOffers', async (req, reply) => {
    try {
      reply.send(
        await req.vclSdk.checkForOffers(
          generateOffersDescriptorFrom(req.body),
          tokenFrom(req.body.sessionToken)
        )
      );
    } catch (error: any) {
      reply.status(error.statusCode ?? 500).send(error);
    }
  });
  fastify.post('/finalizeOffers', async (req, reply) => {
    try {
      reply.send(
        await req.vclSdk.finalizeOffers(
          finalizeOffersDescriptorFrom(req.body.finalizeOffersDescriptor),
          tokenFrom(req.body.sessionToken)
        )
      );
    } catch (error: any) {
      reply.status(error.statusCode ?? 500).send(error);
    }
  });
}
