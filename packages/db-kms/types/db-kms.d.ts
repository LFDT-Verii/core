/*
 * Copyright 2025 Velocity Team
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 */

/**
 * Initializes the KMS
 * @param {FastifyInstance} fastify the fastify instance
 * @returns {(Context) => KMS} a function that returns a KMS instance of the request
 */
import type { FastifyInstance } from 'fastify';
import type { KMS, Context } from './types';

export default function initDbKms(
  fastify: FastifyInstance,
  kmsOptions: Record<string, string>
): (ctx: Context) => KMS;
