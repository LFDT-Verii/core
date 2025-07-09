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

const sampleEducationDegreeGraduation = (organization) => ({
  institution: {
    name: organization.profile.name,
    identifier: organization.didDoc.id,
    place: {
      addressLocality: 'Chicago',
      addressRegion: organization.profile.location.regionCode,
      addressCountry: organization.profile.location.countryCode,
    },
  },
  school: {
    name: 'School of nursing',
    place: {
      name: 'Florida Branch',
      addressLocality: 'Fort Myers',
      addressRegion: 'US-FL',
      addressCountry: 'US',
    },
  },
  programName: 'RN to BSN',
  programType: '1 year full time program',
  programMode: 'Online',
  degreeName: 'Bachelor of Science',
  degreeMajor: ['Nursing'],
  description: `${organization.profile.name}’s RN to BSN Online Option allows working nurses to advance your degree in as few as 3 semesters.
 If you are a registered nurse with an active RN license looking to earn your BSN, Chamberlain's online RN to BSN option can help prepare you 
 for the next step in your career. Our RN to BSN online option allows you to earn your degree while you work.`,
  alignment: [
    {
      targetName: 'Bachelor of Science in Nursing, RN to BSN',
      targetUrl:
        'https://credentialfinder.org/credential/5769/Bachelor_of_Science_in_Nursing,_RN_to_BSN',
      targetDescription: `The RN to BSN completion program has been developed to address the specific needs of working registered nurses who 
return to the university to earn the BSN.`,
      targetFramework: "Credential Engine's Credential Registry",
    },
  ],
  startDate: '2011-08',
  endDate: '2013-06',
  conferredDate: '2014-01',
  honors: 'cum laude',
  recipient: {
    givenName: 'Olivia',
    familyName: 'Hafez',
  },
});

module.exports = { sampleEducationDegreeGraduation };
