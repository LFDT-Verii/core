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

/* eslint-disable */
import { Link } from '@mui/material';
import { useLocation } from 'react-router';
import { Authorities } from '../constants/messageCodes';

function fallbackCopyTextToClipboard(text, cb) {
  const textArea = document.createElement('textarea');
  textArea.value = text;

  // Avoid scrolling to bottom
  textArea.style.top = '0';
  textArea.style.left = '0';
  textArea.style.position = 'fixed';

  document.body.appendChild(textArea);
  textArea.focus();
  textArea.select();

  try {
    const successful = document.execCommand('copy');
    if (!successful) {
      throw new Error('Copying text command was unsuccessful');
    }
    cb();
  } catch (err) {
    cb(err);
  }

  document.body.removeChild(textArea);
}

export function copyTextToClipboard(text, cb) {
  if (!navigator.clipboard) {
    fallbackCopyTextToClipboard(text, cb);
    return;
  }
  navigator.clipboard.writeText(text).then(
    function () {
      cb();
    },
    function (err) {
      cb(err);
    },
  );
}

export const validUrlRegexp =
  /(((([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(%[\da-f]{2})|[!\$&'\(\)\*\+,;=]|:)*@)?(((\d|[1-9]\d|1\d\d|2[0-4]\d|25[0-5])\.(\d|[1-9]\d|1\d\d|2[0-4]\d|25[0-5])\.(\d|[1-9]\d|1\d\d|2[0-4]\d|25[0-5])\.(\d|[1-9]\d|1\d\d|2[0-4]\d|25[0-5]))|((([a-z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(([a-z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])*([a-z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])))\.)+(([a-z]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(([a-z]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])*([a-z]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])))\.?)(:\d*)?)(\/((([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(%[\da-f]{2})|[!\$&'\(\)\*\+,;=]|:|@)+(\/(([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(%[\da-f]{2})|[!\$&'\(\)\*\+,;=]|:|@)*)*)?)?(\?((([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(%[\da-f]{2})|[!\$&'\(\)\*\+,;=]|:|@)|[\uE000-\uF8FF]|\/|\?)*)?(\#((([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(%[\da-f]{2})|[!\$&'\(\)\*\+,;=]|:|@)|\/|\?)*)?$/i;

export const urlRegexp =
  /^((https?|ftp):)?\/\/(((([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(%[\da-f]{2})|[!\$&'\(\)\*\+,;=]|:)*@)?(((\d|[1-9]\d|1\d\d|2[0-4]\d|25[0-5])\.(\d|[1-9]\d|1\d\d|2[0-4]\d|25[0-5])\.(\d|[1-9]\d|1\d\d|2[0-4]\d|25[0-5])\.(\d|[1-9]\d|1\d\d|2[0-4]\d|25[0-5]))|((([a-z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(([a-z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])*([a-z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])))\.)+(([a-z]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(([a-z]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])*([a-z]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])))\.?)(:\d*)?)(\/((([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(%[\da-f]{2})|[!\$&'\(\)\*\+,;=]|:|@)+(\/(([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(%[\da-f]{2})|[!\$&'\(\)\*\+,;=]|:|@)*)*)?)?(\?((([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(%[\da-f]{2})|[!\$&'\(\)\*\+,;=]|:|@)|[\uE000-\uF8FF]|\/|\?)*)?(\#((([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(%[\da-f]{2})|[!\$&'\(\)\*\+,;=]|:|@)|\/|\?)*)?$/i;

export const secureUrlRegexp =
  /^(https):\/\/(((([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(%[\da-f]{2})|[!\$&'\(\)\*\+,;=]|:)*@)?(((\d|[1-9]\d|1\d\d|2[0-4]\d|25[0-5])\.(\d|[1-9]\d|1\d\d|2[0-4]\d|25[0-5])\.(\d|[1-9]\d|1\d\d|2[0-4]\d|25[0-5])\.(\d|[1-9]\d|1\d\d|2[0-4]\d|25[0-5]))|((([a-z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(([a-z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])*([a-z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])))\.)+(([a-z]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(([a-z]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])*([a-z]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])))\.?)(:\d*)?)(\/((([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(%[\da-f]{2})|[!\$&'\(\)\*\+,;=]|:|@)+(\/(([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(%[\da-f]{2})|[!\$&'\(\)\*\+,;=]|:|@)*)*)?)?(\?((([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(%[\da-f]{2})|[!\$&'\(\)\*\+,;=]|:|@)|[\uE000-\uF8FF]|\/|\?)*)?(\#((([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(%[\da-f]{2})|[!\$&'\(\)\*\+,;=]|:|@)|\/|\?)*)?$/i;

export const webSiteRegexp =
  /^((https?:\/\/)|(www\.))[-a-zA-Z0-9@:%._\+~#=]{2,256}\.[a-z]{2,20}\b([-a-zA-Z0-9@:%_\+.~#?&//=]{0,752})$/;

export const webSiteHttpsRegexp =
  /^https:\/\/[-a-zA-Z0-9@:%._\+~#=]{2,256}\.[a-z]{2,20}\b([-a-zA-Z0-9@:%_\+.~#?&//=]{0,752})$/;

export const webSiteCleanPathRegexp =
  /^https:\/\/[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,20}$/;

export const formatWebSiteUrl = (value) => {
  if (value && !value.startsWith('http')) {
    return `https://${value}`;
  }
  return value;
};

export const formatRegistrationNumbers = (registrationNumbers = []) => {
  return registrationNumbers
    .filter((item) => !!item.number)
    .map((item) => (item.uri ? { ...item, uri: formatWebSiteUrl(item.uri) } : item));
};

export const useIsHideSidebar = () => {
  const location = useLocation();
  return location.pathname.startsWith('/organizations/create') || location.pathname === '/';
};

export const DID_HINT =
  'A decentralized identifiers (DID) is a type of identifier that enables verifiable, decentralized digital identity. A DID in The Velocity Network refers to an organization.';

export const objectToString = (data) => JSON.stringify(data, null, 2);

export const WEBSITE_HINT =
  'The website will be the basis of the organization identifier. It must be unique, use https, and may not contain a path. For example https://www.example.com';
export const WEBSITE_HINT_SHORT = 'The website is be the basis of the organization identifier.';
export const SUPPORT_EMAIL_HINT =
  'This email address will be published and will be visible to individuals using the career wallet to contact the organization.';
export const TECHNICAL_EMAIL_HINT =
  'This email address will be used by the Velocity Network support team to contact the organization in the event of any technical issues concerning the organization’s registration or the services it operates on Velocity Network, such as issuing, relying party, credential agent operation, and career wallet.';
export const ADMINISTRATOR_DETAILS_HINT =
  'The administrator is the person managing the organization’s registration in the Velocity Network Registrar. Typically, this would be the person filling in the details of the organization in the registrar.';
export const SIGNATORY_DETAILS_HINT =
  'The signatory is the person authorized to sign the organization’s participation agreement in the Velocity Network. Once the administrator registers the organization in the Velocity Network Registrar, an email will be sent to the signatory authority, asking them to accept the registration and confirm the participation agreement.';
export const DUNS_HINT = (
  <>
    The organization’s number in the Dan & Bradstreet system.{' '}
    <Link href="https://www.dnb.com/duns.html" target="_blank" color="inherit">
      Click here
    </Link>{' '}
    for more information.
  </>
);
export const LEI_HINT = (
  <>
    The organization’s Legal Entity Identifier (LEI).{' '}
    <Link href="https://www.leinumber.com/" target="_blank" color="inherit">
      Click here
    </Link>{' '}
    for more information.
  </>
);
export const NATIONAL_AUTHORITY_HINT = (
  <>
    Any other country-specific registration identifier, other than D-U-N-S® or LEI. If applicable,
    please indicate the website of the local country’s registration authority as well as the
    organization’s number or identifier.
  </>
);

export const ALSO_KNOWN_AS_HINT =
  'Also Known As is a list of aliases that the organization can be identified by';

const linkToWebhookDocs =
  'https://www.velocitynetwork.foundation/main/developers-guide-organizations#cao-secure-messages-url-management';
export const ERRORS = {
  secureWebHook: (
    <>
      Secure webhook response doesn’t meet requirements. Follow instructions{' '}
      <Link href={linkToWebhookDocs} color="inherit" target="_blank">
        here
      </Link>
    </>
  ),
  websiteExists:
    'This organization’s website is already registered in our system. Please check and try again.',
  default: 'Your organization profile could not be saved due to a system error. Please try again',
};

export const LINKEDIN_ORGANIZATION_ID = `
To retrieve your LinkedIn Company ID, visit your company page on LinkedIn as an admin, and copy the number from the URL.\n
For example, if your company page URL is https://www.linkedin.com/company/1234567/admin/, the ID is 1234567
`;

export const SIGNATORY_EMAIL_HINT = 'Please ensure that the email address provided is a personal corporate email (e.g., sam@acme.com). Generic or role-based email addresses (e.g., manager@acme.com) will not be accepted.';

export const parseJwt = (token) => {
  try {
    return JSON.parse(atob(token.split('.')[1]));
  } catch (e) {
    return null;
  }
};
