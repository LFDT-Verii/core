const { omit, flow, set } = require('lodash/fp');
const { dateify } = require('@verii/common-functions');
const {
  getDisclosureConfigurationType,
} = require('./get-disclosure-configuration-type');

const parseBodyToDisclosure = (body, context) => {
  return flow(
    dateify(['deactivationDate']),
    omit(['setIssuingDefault']),
    set('configurationType', getDisclosureConfigurationType(body, context)),
  )(body);
};

module.exports = {
  parseBodyToDisclosure,
};
