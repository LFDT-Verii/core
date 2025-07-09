/**
 * Created by Michael Avoyan on 14/07/2024.
 *
 * Copyright 2022 Velocity Career Labs inc.
 * SPDX-License-Identifier: Apache-2.0
 */
import {
  didJwkDescriptorFrom,
  didJwkFrom,
  jwtDescriptorFrom,
  jwtFromJson,
  publicJwkFrom,
  tokenFrom,
} from '../utils/Converter';

export default async function cryptoServicesRoutes(fastify) {
  fastify.post('/verifyJwt', async (req, reply) => {
    try {
      reply.send(
        await req.vclSdk.verifyJwt(
          jwtFromJson(req.body.jwt),
          publicJwkFrom(req.body.publicJwk),
          tokenFrom(req.body.remoteCryptoServicesToken)
        )
      );
    } catch (error: any) {
      reply.status(error.statusCode ?? 500).send(error);
    }
  });
  fastify.post('/generateSignedJwt', async (req, reply) => {
    try {
      reply.send(
        await req.vclSdk.generateSignedJwt(
          jwtDescriptorFrom(req.body.jwtDescriptor),
          didJwkFrom(req.body.didJwk),
          tokenFrom(req.body.remoteCryptoServicesToken)
        )
      );
    } catch (error: any) {
      reply.status(error.statusCode ?? 500).send(error);
    }
  });
  fastify.post('/generateDidJwk', async (req, reply) => {
    try {
      reply.send(
        await req.vclSdk.generateDidJwk(didJwkDescriptorFrom(req.body))
      );
    } catch (error: any) {
      reply.status(error.statusCode ?? 500).send(error);
    }
  });
}
