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

/* eslint-disable import/no-extraneous-dependencies */
import '@verii/tests-helpers/src/setup-react-tests.mjs';
import { TextEncoder, TextDecoder } from 'util';
import { register } from 'node:module';

register('./alias-resolver.mjs', import.meta.url);

// eslint-disable-next-line better-mutation/no-mutation
global.TextEncoder = TextEncoder;
// eslint-disable-next-line better-mutation/no-mutation
global.TextDecoder = TextDecoder;
