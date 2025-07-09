/*
 * Copyright 2024 Velocity Team
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
const { isString } = require('lodash/fp');
const { ObjectId } = require('mongodb');
const { initAutoboxFieldsExtension } = require('./autobox-fields-extension');

const initObjectIdAutoboxExtension = (propOrProps) => {
  const autoboxFieldsExtension = initAutoboxFieldsExtension(
    propOrProps,
    objectIdAutobox
  );
  return (parent) => {
    const { prepFilter, prepModification } = autoboxFieldsExtension(parent);
    return {
      prepFilter,
      prepModification,
      extensions: parent.extensions.concat(['objectIdAutoboxExtension']),
    };
  };
};

const OBJECT_ID_FORMAT = /^[0-9a-fA-F]{24}$/;

const objectIdAutobox = (val) =>
  isString(val) && OBJECT_ID_FORMAT.test(val) ? new ObjectId(val) : val;

module.exports = {
  initObjectIdAutoboxExtension,
};
