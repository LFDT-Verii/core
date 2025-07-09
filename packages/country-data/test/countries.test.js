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

const { find } = require('lodash/fp');
const {
  getCountries,
  isLanguageCodeValid,
  isLanguageSupported,
  alpha3ToAlpha2,
} = require('..');

const expectGetCountriesObjShape = (getCountriesResult) => {
  getCountriesResult.forEach((item) => {
    expect(item.name).toEqual(expect.any(String));
    expect(item.code).toEqual(expect.any(String));
    expect(item.code).toHaveLength(2);
    expect(item.callingCode).toEqual(expect.any(String));
    expect(item.regions).toEqual(expect.any(Array));
    item.regions.forEach((subItem) => {
      expect(subItem.name).toEqual(expect.any(String));
      expect(subItem.code).toEqual(expect.any(String));
    });
  });
};

describe('Countries test suite', () => {
  describe('Language code validation test suite', () => {
    it('validation should return false with malformatted country code', async () => {
      const result = isLanguageCodeValid(undefined);
      expect(result).toEqual(false);
    });

    it('validation should return true with a properly formatted but unsupported country code', async () => {
      const result = isLanguageCodeValid('zz');
      expect(result).toEqual(true);
    });
  });

  describe('Language code support test suite', () => {
    it('support check should return false with unsupported language', async () => {
      const result = isLanguageSupported('aa');
      expect(result).toEqual(false);
    });

    it('support check should return true with a supported language', async () => {
      const result = isLanguageSupported('en');
      expect(result).toEqual(true);
    });
  });

  describe('3 letter country code to 2 letter country code test suite', () => {
    it('should convert 3 letter country code to 2 letter country code', async () => {
      const twoLetterIsrael = alpha3ToAlpha2('ISR');

      const twoLetterUnitedStates = alpha3ToAlpha2('USA');
      const twoLetterColumbia = alpha3ToAlpha2('COL');
      const twoLetterIndia = alpha3ToAlpha2('IND');
      const twoLetterTurkey = alpha3ToAlpha2('TUR');
      const twoLetterSingapore = alpha3ToAlpha2('SGP');
      const twoLetterChile = alpha3ToAlpha2('CHL');

      expect(twoLetterIsrael).toEqual('IL');
      expect(twoLetterUnitedStates).toEqual('US');
      expect(twoLetterColumbia).toEqual('CO');
      expect(twoLetterIndia).toEqual('IN');
      expect(twoLetterTurkey).toEqual('TR');
      expect(twoLetterSingapore).toEqual('SG');
      expect(twoLetterChile).toEqual('CL');
    });

    it('should return undefined for unknown three letter country code', async () => {
      const twoLetterFoo = alpha3ToAlpha2('foo');
      expect(twoLetterFoo).toEqual(undefined);
    });
  });

  it('Should error with malformatted language code', async () => {
    let err;
    try {
      await getCountries(undefined);
    } catch (e) {
      err = e;
    }
    expect(err.message).toEqual('Language code is malformatted');
  });

  it('Should error with unsupported language code', async () => {
    let err;
    try {
      await getCountries('zz');
    } catch (e) {
      err = e;
    }
    expect(err.message).toEqual('Language is not supported');
  });

  it('Should return countries with English names', async () => {
    const countries = await getCountries('en');
    expectGetCountriesObjShape(countries);
    expect(countries[0].name).toEqual('Afghanistan');
    expect(find({ name: 'Australia' }, countries)).toEqual({
      callingCode: '+61',
      code: 'AU',
      name: 'Australia',
      regions: [
        {
          code: 'ACT',
          name: 'Australian Capital Territory',
        },
        {
          code: 'NSW',
          name: 'New South Wales',
        },
        {
          code: 'NT',
          name: 'Northern Territory',
        },
        {
          code: 'QLD',
          name: 'Queensland',
        },
        {
          code: 'SA',
          name: 'South Australia',
        },
        {
          code: 'TAS',
          name: 'Tasmania',
        },
        {
          code: 'VIC',
          name: 'Victoria',
        },
        {
          code: 'WA',
          name: 'Western Australia',
        },
      ],
    });
    expect(find({ name: 'Jersey' }, countries)).toEqual({
      callingCode: '+44',
      code: 'JE',
      name: 'Jersey',
      regions: [],
    });
  });

  it('Should return countries with Dutch names', async () => {
    const countries = await getCountries('nl');
    expectGetCountriesObjShape(countries);
    expect(countries[1].name).toEqual('Republiek Albanië');
  });
});
