/**
 * Created by Michael Avoyan on 14/07/2024.
 *
 * Copyright 2022 Velocity Career Labs inc.
 * SPDX-License-Identifier: Apache-2.0
 */
import { VCLExchangeDescriptor } from '@verii/vnf-nodejs-wallet-sdk';
import {
  authTokenFrom,
  presentationRequestDescriptorFrom,
  presentationSubmissionFrom,
  submissionResultFrom,
} from '../utils/Converter';

export default async function inspectionRoutes(fastify) {
  fastify.post('/getPresentationRequest', async (req, reply) => {
    try {
      reply.send(
        await req.vclSdk.getPresentationRequest(
          presentationRequestDescriptorFrom(req.body),
        ),
      );
    } catch (error: any) {
      reply.status(error.statusCode ?? 500).send(error);
    }
  });
  fastify.post('/submitPresentation', async (req, reply) => {
    try {
      reply.send(
        await req.vclSdk.submitPresentation(
          presentationSubmissionFrom(req.body.presentationSubmission),
          authTokenFrom(req.body.authToken),
        ),
      );
    } catch (error: any) {
      reply.status(error.statusCode ?? 500).send(error);
    }
  });
  fastify.post('/getExchangeProgress', async (req, reply) => {
    try {
      reply.send(
        await req.vclSdk.getExchangeProgress(
          new VCLExchangeDescriptor(
            presentationSubmissionFrom(req.body.presentationSubmission),
            submissionResultFrom(req.body.submissionResult),
          ),
        ),
      );
    } catch (error: any) {
      reply.status(error.statusCode ?? 500).send(error);
    }
  });
}
