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

const simpleStringData = {
  data: [
    { field1: 'value1', field2: { value: { value1: 'value2' } } },
    { field1: 'value3', field2: { value: { value1: 'value4' } } },
  ],
  result:
    '"field1","field2_value_value1"\r\n"value1","value2"\r\n"value3","value4"',
};

const simpleData = {
  data: [
    { field1: 'value1', field2: 'value2' },
    { field1: 'value3', field2: 'value4' },
  ],
  result: '"field1","field2"\r\n"value1","value2"\r\n"value3","value4"',
};

const deepObjectData = {
  data: [
    {
      field1: 'value1',
      field2: { field3: new Date('2022-11-22T12:35:31.173Z') },
    },
    { field1: 'value3', field2: { field5: 'value4' } },
  ],
  result:
    '"field1","field2_field3"\r\n"value1","2022-11-22T12:35:31.173Z"\r\n"value3","-"',
};

const objectWithArrayData = {
  data: [
    {
      field1: 'value1',
      fieldItems: [
        { field3: 'value2' },
        { field3: 'value3' },
        { field3: 'value4' },
      ],
    },
  ],
  result:
    '"field1","fieldItems_field3"\r\n"value1","value2"\r\n"-","value3"\r\n"-","value4"',
};
const objectWithArrayStringData = {
  data: [
    {
      field1: 'value1',
      fieldItems: ['value2', 'value3', 'value4'],
    },
  ],
  result: '"field1","fieldItems"\r\n"value1","value2, value3, value4"',
};
module.exports = {
  simpleData,
  simpleStringData,
  deepObjectData,
  objectWithArrayData,
  objectWithArrayStringData,
};
