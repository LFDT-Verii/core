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

import { ObjectId } from 'mongodb';
import { JsonWebKey } from 'crypto';

export interface KeySpec {
  algorithm: 'ec' | 'rsa';
  curve?: 'P-256' | 'P-384' | 'P-512' | 'secp256k1';
}

type Key = JsonWebKey;
type Id = string | ObjectId;

export interface KmsKey extends KeySpec {
  keyId: Id;
  publicJwk: JsonWebKey;
  createdAt: 1;
  updatedAt: 1;
}

export interface KmsSecret {
  keyId: Id;
  secret: string;
  createdAt: 1;
  updatedAt: 1;
}

export interface ImportableKey extends KeySpec {
  privateKey: Key;
  publicKey: Key;
}

export interface ExportedKey extends KmsKey {
  privateJwk: JsonWebKey;
  secret: string;
}

export interface ImportableSecret extends KeySpec {
  secret: string;
}

export interface KMS {
  createKey: (kmsSpec: KeySpec) => Promise<KmsKey>;
  importKey: (importableKey: ImportableKey) => Promise<KmsKey>;
  importSecret: (importableSecret: ImportableSecret) => Promise<KmsSecret>;
  exportKeyOrSecret: (keyId: Id) => Promise<ExportedKey>;
  signJwt: (
    payload: Record<string, unknown>,
    keyId: Id,
    options: Record<string, string>
  ) => Promise<string>;
  verifyJwt: (
    jwt: string,
    keyId: Id,
    options: Record<string, string>
  ) => { headers: Record<string, string>; payload: Record<string, unknown> };
}

export interface Context {
  /**
   * config object containing the contract addresses for the chain. TODO tighten up type safety
   */
  config: object;
}

declare module 'fastify' {
  interface FastifyRequest {
    kms: KMS;
  }
}
