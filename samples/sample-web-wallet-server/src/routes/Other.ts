/**
 * Created by Michael Avoyan on 14/07/2024.
 *
 * Copyright 2022 Velocity Career Labs inc.
 * SPDX-License-Identifier: Apache-2.0
 */
import {
  organizationsSearchDescriptorFrom,
  verifiedProfileDescriptorFrom,
} from '../utils/Converter';

export default async function otherRoutes(fastify) {
  fastify.post('/searchForOrganizations', async (req, reply) => {
    try {
      reply.send(
        await req.vclSdk.searchForOrganizations(
          organizationsSearchDescriptorFrom(req.body)
        )
      );
    } catch (error: any) {
      reply.status(error.statusCode ?? 500).send(error);
    }
  });
  fastify.post('/getVerifiedProfile', async (req, reply) => {
    try {
      reply.send(
        await req.vclSdk.getVerifiedProfile(
          verifiedProfileDescriptorFrom(req.body)
        )
      );
    } catch (error: any) {
      reply.status(error.statusCode ?? 500).send(error);
    }
  });
}
