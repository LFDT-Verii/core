/**
 * Copyright 2023 Velocity Team
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

const presentationRequestSchema = require('./presentation-request.schema.json');
const presentationSubmissionSchema = require('./presentation-submission.schema.json');
const siopPresentationSubmissionSchema = require('./siop-presentation-submission.schema.json');
const velocityPresentationSubmissionSchema = require('./velocity-presentation-submission.schema.json');
const velocityPresentationSubmissionResponseSchema = require('./velocity-presentation-submission.response.200.schema.json');
const holderDisclosureSchema = require('./holder-disclosure.schema.json');
const presentationDefinitionV1Schema = require('./presentation-definition.v1.schema.json');

module.exports = {
  holderDisclosureSchema,
  presentationRequestSchema,
  presentationSubmissionSchema,
  siopPresentationSubmissionSchema,
  velocityPresentationSubmissionSchema,
  velocityPresentationSubmissionResponseSchema,
  presentationDefinitionV1Schema,
};
