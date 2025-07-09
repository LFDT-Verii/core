const { get, includes, isNil, map, omitBy, isEmpty } = require('lodash/fp');
const { formatISO } = require('date-fns/fp');
const { nanoid } = require('nanoid');
const { loadHandlebarsTemplate, computeActivationDate } = require('../helpers');
const { idCredentialTypeToPick } = require('./constants');
const { getColIndex, prepareVariableSets } = require('../helpers');

const EMAIL_REGEX =
  // eslint-disable-next-line max-len
  /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
const PHONE_REGEX = /\(?([0-9]{3})\)?([ .-]?)([0-9]{3})\2([0-9]{4})/;

const VENDOR_USER_ID_PATH = 'credentialSubject.vendorUserId';

const prepareExchangeOffers = async (csvHeaders, csvRows, options) => {
  const variableSets = await prepareVariableSets(csvHeaders, csvRows, options);
  const offerTemplate = loadHandlebarsTemplate(options.offerTemplateFilename);
  return map(
    (variableSet) => ({
      newOffer: prepareNewOffer({
        template: offerTemplate,
        variableSet,
        ...options,
      }),
      newExchange: prepareNewExchange({ variableSet, ...options }),
    }),
    variableSets
  );
};

const prepareNewOffer = ({ template, variableSet, label }) => {
  validateVariableSet(variableSet);
  const offerString = template(variableSet);
  const offer = JSON.parse(offerString);
  validateVendorUserIdInOffer(offer, variableSet);
  return omitBy(isNil, {
    ...offer,
    offerId: variableSet.offerId ?? nanoid(),
    label,
  });
};

const validateVariableSet = (variableSet) => {
  if (
    variableSet.email == null &&
    variableSet.phone == null &&
    variableSet.identifier == null
  ) {
    throw new Error('"email", "phone", or "identifier" column must be defined');
  }

  const { email, phone, vendorUserId } = variableSet;

  validateVendorUserIdVariable(vendorUserId);
  validateEmailVariable(email);
  validatePhoneVariable(phone);
};

const validateVendorUserIdVariable = (vendorUserId) => {
  if (isEmpty(vendorUserId)) {
    throw new Error(
      'vendorUserId variable must exist. Use the -u <column> option'
    );
  }
};

const validateEmailVariable = (email) => {
  if (!email) return;

  if (!EMAIL_REGEX.test(email)) {
    throw new Error(`${email} is not a valid email`);
  }
};

const validatePhoneVariable = (phone) => {
  if (!phone) return;

  if (!PHONE_REGEX.test(phone)) {
    throw new Error(`${phone} is not a valid phone`);
  }
};

const validateVendorUserIdInOffer = (offer, variableSet) => {
  const value = get(VENDOR_USER_ID_PATH, offer);
  if (!includes(value, variableSet)) {
    throw new Error(
      `${VENDOR_USER_ID_PATH}: ${value} cannot be hardcoded and must be defined in ${JSON.stringify(
        variableSet
      )})`
    );
  }
};

const matcherToIdCredentialType = (idCredentialType, variableSet) => {
  const typeToVariable = {
    'EmailV1.0': variableSet.email,
    'PhoneV1.0': variableSet.phone,
    'DriversLicenseV1.0': variableSet.identifier,
    'IdDocumentV1.0': variableSet.identifier,
    'NationalIdCardV1.0': variableSet.identifier,
    'PassportV1.0': variableSet.identifier,
    'ProofOfAgeV1.0': variableSet.identifier,
    'ResidentPermitV1.0': variableSet.identifier,
  };
  return typeToVariable[idCredentialType] || variableSet.email;
};

const prepareNewExchange = ({ variableSet, label, idCredentialType }) =>
  omitBy(isNil, {
    type: 'ISSUING',
    identityMatcherValues: [
      matcherToIdCredentialType(idCredentialType, variableSet),
    ],
    label,
  });

const prepareNewDisclosureRequest = (
  csvHeaders,
  {
    label,
    termsUrl,
    purpose,
    idCredentialType,
    identifierMatchColumn,
    vendorUseridColumn,
    authTokenExpiresIn,
    ...options
  }
) => {
  const activationDate = computeActivationDate(options);

  const newDisclosureRequest = {
    offerMode: 'preloaded',
    configurationType: 'issuing',
    vendorEndpoint: 'integrated-issuing-identification',
    types: [
      {
        type: idCredentialType,
      },
    ],
    identityMatchers: {
      rules: [
        {
          valueIndex: getColIndex(csvHeaders, identifierMatchColumn),
          path: [idCredentialTypeToPick[idCredentialType]],
          rule: 'pick',
        },
      ],
      vendorUserIdIndex: getColIndex(csvHeaders, vendorUseridColumn),
    },
    setIssuingDefault: true,
    duration: '1h', // 1 hour by default
    vendorDisclosureId: Date.now(),
    purpose: purpose ?? 'Issuing Career Credential', // by default have a generic message
    activationDate: formatISO(activationDate),
    authTokenExpiresIn: Number(authTokenExpiresIn),
    termsUrl,
    label,
  };

  return omitBy(isNil, newDisclosureRequest);
};

module.exports = {
  prepareNewDisclosureRequest,
  prepareExchangeOffers,
};
