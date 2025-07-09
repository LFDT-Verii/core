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

const { set } = require('lodash/fp');

const multitenantExtension =
  ({ repoProp = 'tenantId', tenantProp = '_id', migrateFrom } = {}) =>
  (parent, context) => {
    return {
      prepFilter: (filter) => {
        if (context?.tenant?.[tenantProp] == null && filter[repoProp] == null) {
          throw new Error(`context.tenant[${tenantProp}] is undefined`);
        }

        if (context?.tenant?.[tenantProp] == null) {
          return parent.prepFilter(filter);
        }

        const preppedFilter =
          migrateFrom == null
            ? {
                ...filter,
                [repoProp]: context.tenant[tenantProp],
              }
            : {
                ...filter,
                $or: [
                  {
                    [repoProp]: context.tenant[tenantProp],
                  },
                  {
                    [migrateFrom.repoProp]:
                      context.tenant[migrateFrom.tenantProp],
                  },
                ],
              };

        return parent.prepFilter(preppedFilter);
      },
      prepModification: (val, ...args) => {
        if (context?.tenant?.[tenantProp] == null && val[repoProp] == null) {
          throw new Error(`context.tenant[${tenantProp}] is undefined`);
        }

        const modifiedVal =
          context?.tenant?.[tenantProp] != null
            ? set(repoProp, context.tenant[tenantProp], val)
            : val;

        return parent.prepModification(modifiedVal, ...args);
      },
      extensions: parent.extensions.concat(['multitenantExtension']),
    };
  };

module.exports = { multitenantExtension };
