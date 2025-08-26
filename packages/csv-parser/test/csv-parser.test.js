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
const { describe, it } = require('node:test');
const { expect } = require('expect');

const { parseToCsv } = require('../index');
const {
  simpleData,
  deepObjectData,
  objectWithArrayData,
  simpleStringData,
  objectWithArrayStringData,
} = require('./helpers/prepared-data');

describe('Csv parser test suite', () => {
  it('Should throw error if data invalid', async () => {
    await expect(parseToCsv('test')).rejects.toStrictEqual(
      Error('Data must be array and not empty')
    );
    await expect(parseToCsv(undefined)).rejects.toStrictEqual(
      Error('Data must be array and not empty')
    );
    await expect(parseToCsv(null)).rejects.toStrictEqual(
      Error('Data must be array and not empty')
    );
    await expect(parseToCsv(0)).rejects.toStrictEqual(
      Error('Data must be array and not empty')
    );
    await expect(parseToCsv([])).rejects.toStrictEqual(
      Error('Data must be array and not empty')
    );
  });

  it('Should return csv', async () => {
    const { data, result: expectedResult } = simpleData;
    const result = await parseToCsv(data);
    expect(result).toBe(expectedResult);
  });

  it('Should return csv with formatting label', async () => {
    const { data, result: expectedResult } = simpleStringData;
    const result = await parseToCsv(data);
    expect(result).toBe(expectedResult);
  });

  it('Should return csv with deep object', async () => {
    const { data, result: expectedResult } = deepObjectData;
    const result = await parseToCsv(data);
    expect(result).toBe(expectedResult);
  });

  it('Should return csv with object which has array', async () => {
    const { data, result: expectedResult } = objectWithArrayData;
    const result = await parseToCsv(data, ['fieldItems']);
    expect(result).toBe(expectedResult);
  });
  it('Should return csv with object which has array of strings', async () => {
    const { data, result: expectedResult } = objectWithArrayStringData;
    const result = await parseToCsv(data);
    expect(result).toBe(expectedResult);
  });

  it('Should return csv with object which has array of different objects', async () => {
    const data = [
      {
        commonField: 'test',
        fieldItems: [
          {
            field1: 'test1',
            field2: 'test2',
          },
          {
            field1: 'test3',
            field2: 'test4',
            field3: 'test5',
          },
          {
            field4: 'test6',
          },
        ],
      },
    ];
    const result = await parseToCsv(data, ['fieldItems']);
    expect(result).toBe(
      // eslint-disable-next-line max-len
      '"commonField","fieldItems_field1","fieldItems_field2","fieldItems_field3","fieldItems_field4"\r\n"test","test1","test2","-","-"\r\n"-","test3","test4","test5","-"\r\n"-","-","-","-","test6"'
    );
  });
});
