/**
 * Copyright 2026 Velocity Team
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
 */

import {
  buildVcV2Credential,
  type VcV2CredentialBuildOptions,
  type VcV2LinkedData,
  type VcV2SchemaDescriptor,
} from '../../types/types';

declare const validBuildOptions: VcV2CredentialBuildOptions;

export const validCredential = buildVcV2Credential(validBuildOptions);

export const validSchemaDescriptor: VcV2SchemaDescriptor = {
  id: 'https://example.com/schema.json',
  type: 'JsonSchema',
};

export const validStatusDescriptor: VcV2LinkedData = {
  id: 'https://example.com/status/1',
  type: ['ExampleCredentialStatus', 'VelocityCredentialStatus'],
};

export const invalidSchemaDescriptor: VcV2SchemaDescriptor = {
  id: 'https://example.com/schema.json',
  // @ts-expect-error VC 2.0 schema descriptors require one type string.
  type: ['JsonSchema', 'OtherSchema'],
};
