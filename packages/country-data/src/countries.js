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

const {
  langs,
  getAlpha2Codes,
  getName,
  alpha3ToAlpha2,
} = require('i18n-iso-countries');
const iso31662DB = require('iso3166-2-db');
const countryCodes = require('country-codes-list');
const {
  flow,
  isEmpty,
  isString,
  keys,
  map,
  reject,
  some,
  sortBy,
} = require('lodash/fp');

const getNameOfCountry = getName;

const countryCodesObject = countryCodes.customList(
  'countryCode',
  '+{countryCallingCode}'
);

const ERROR_MESSAGE_LANGUAGE_CODE_IS_MALFORMATTED =
  'Language code is malformatted';
const ERROR_MESSAGE_LANGUAGE_IS_NOT_SUPPORTED = 'Language is not supported';
const DEFAULT_FALLBACK_LANGUAGE_CODE = 'en';

const isLanguageSupported = (languageCode) =>
  some((code) => code === languageCode, langs());

const isLanguageCodeValid = (languageCode) =>
  isString(languageCode) && languageCode.length === 2;

const getCountries = async (languageCode) => {
  if (!isLanguageCodeValid(languageCode)) {
    throw new Error(ERROR_MESSAGE_LANGUAGE_CODE_IS_MALFORMATTED);
  }
  if (!isLanguageSupported(languageCode)) {
    throw new Error(ERROR_MESSAGE_LANGUAGE_IS_NOT_SUPPORTED);
  }
  const buildRegions = initBuildRegions(languageCode);
  const countryCodesObj = getAlpha2Codes();

  const countries = map(
    (key) => ({
      name: getNameOfCountry(key, languageCode),
      code: key,
      regions: buildRegions(iso31662DB.getRegionsFor(key)),
      callingCode: getPhoneCodeOfCountry(key),
    }),
    keys(countryCodesObj)
  );
  return countries;
};

const initBuildRegions = (languageCode) => (rawRegions) => {
  return flow(
    // remove regions with no iso code
    reject((region) => isEmpty(region.iso)),
    map((region) => ({
      name: getRegionName(region, languageCode),
      code: region.iso,
    })),
    sortBy(['code'])
  )(rawRegions);
};

const getRegionName = (regionObj, languageCode) => {
  if (regionObj.names[languageCode]) {
    return regionObj.names[languageCode];
  }
  if (regionObj.names[DEFAULT_FALLBACK_LANGUAGE_CODE]) {
    return regionObj.names[DEFAULT_FALLBACK_LANGUAGE_CODE];
  }
  return regionObj.name;
};

const getPhoneCodeOfCountry = (countryCode) => {
  if (countryCode === 'XK') {
    return '';
  }
  return countryCodesObject[countryCode];
};

module.exports = {
  getCountries,
  isLanguageSupported,
  isLanguageCodeValid,
  alpha3ToAlpha2,
};
