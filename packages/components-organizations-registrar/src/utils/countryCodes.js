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

import React from 'react';
import { useGetList } from 'react-admin';

const CODES_FALLBACK = [
  {
    code: 'AU',
    name: 'Australia',
    callingCode: '+61',
    regionCodes: [
      {
        code: 'AU-NSW',
        name: 'New South Wales',
      },
      {
        code: 'AU-VIC',
        name: 'Victoria',
      },
    ],
  },
  {
    code: 'IL',
    name: 'Israel',
    callingCode: '+972',
  },
  {
    code: 'US',
    name: 'United States Of America',
    callingCode: '+1',
    regionCodes: [
      {
        code: 'US-NY',
        name: 'New York',
      },
      {
        code: 'US-CA',
        name: 'California',
      },
    ],
  },
];

const useCountryCodes = () => {
  const { data = CODES_FALLBACK, isLoading } = useGetList('reference/countries', undefined, {
    cacheTime: Infinity,
    retryOnMount: false,
  });

  const codesMap = React.useMemo(
    () =>
      data.reduce((acc, item) => {
        acc[item.code] = item;
        return acc;
      }, {}),
    [data],
  );

  const getCountryNameByCode = React.useCallback(
    (code) =>
      codesMap[code]
        ? codesMap[code].name
        : new Intl.DisplayNames(['en'], { type: 'region' }).of(code),
    [codesMap],
  );

  return { data, codesMap, isLoading, getCountryNameByCode };
};

export default useCountryCodes;
