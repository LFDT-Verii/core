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
const { castArray } = require('lodash/fp');

const initAutoboxFieldsExtension = (propOrProps, autoboxFunc) => {
  const props = castArray(propOrProps);
  return (parent) => {
    return {
      prepFilter: (filter) => {
        const newFilter = autoboxReducer(filter, props, autoboxFunc);
        return parent.prepFilter(newFilter);
      },
      prepModification: (rawVal, ...args) => {
        const newModification = autoboxReducer(rawVal, props, autoboxFunc);
        return parent.prepModification(newModification, ...args);
      },
      extensions: parent.extensions.concat(['autoboxField']),
    };
  };
};
const autoboxReducer = (originalVal, props, autoboxer) => {
  const newVal = { ...originalVal };
  for (const prop of props) {
    if (originalVal[prop] != null) {
      newVal[prop] = autoboxer(originalVal[prop]);
    }
  }
  return newVal;
};

module.exports = {
  initAutoboxFieldsExtension,
};
