/**
 * Created by Michael Avoyan on 27/06/2024.
 *
 * Copyright 2022 Velocity Career Labs inc.
 * SPDX-License-Identifier: Apache-2.0
 */

import initializationRoutes from './Initialization';
import inspectionRoutes from './Inspection';
import issuingRoutes from './Issuing';
import cryptoServicesRoutes from './CryptoServices';
import selfReportRoutes from './SelfReport';
import otherRoutes from './Other';
import authTokenRoutes from './AuthToken';

export default async function routes(fastify) {
  await initializationRoutes(fastify);
  await inspectionRoutes(fastify);
  await issuingRoutes(fastify);
  await cryptoServicesRoutes(fastify);
  await selfReportRoutes(fastify);
  await authTokenRoutes(fastify);
  await otherRoutes(fastify);
}
