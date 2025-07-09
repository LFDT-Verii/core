/*
 * Copyright 2025 Velocity Team
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

const newError = require('http-errors');
const {
  flatten,
  isEmpty,
  first,
  includes,
  toLower,
  every,
} = require('lodash/fp');
const { ExchangeStates } = require('../../exchanges');
const { PresentationErrors } = require('../domains');
const { getJsonAtPath } = require('../../common');

const doFindExchange = async (docValue, rule, exchangeCursor) => {
  for await (const exchange of exchangeCursor) {
    if (
      exchange.identityMatcherValues &&
      evalRule(flatten(docValue), rule, exchange.identityMatcherValues)
    ) {
      return exchange;
    }
  }
  return null;
};
const findExchange = async (docValue, rule, context) => {
  const { tenant, exchange, repos } = context;
  if (exchange.identityMatcherValues) {
    return doFindExchange(docValue, rule, [exchange]);
  }
  const exchangeCursor = repos.exchanges
    .collection()
    .find({ disclosureId: exchange.disclosureId, tenantId: tenant._id });
  const matchingExchange = await doFindExchange(docValue, rule, exchangeCursor);
  await exchangeCursor.close();
  return matchingExchange;
};
const matchIdentityOnExchange = async (
  identityDoc,
  { identityMatchers },
  context
) => {
  const { vendorUserIdIndex } = identityMatchers;
  const { docValue, rule } = validatePresentation(
    identityDoc,
    identityMatchers
  );

  const matchingExchange = await findExchange(docValue, rule, context);

  if (matchingExchange == null) {
    throw newError(401, 'User Not Found', {
      exchangeErrorState: ExchangeStates.NOT_IDENTIFIED,
      errorCode: 'integrated_identification_user_not_found',
    });
  }
  return {
    vendorUserId: matchingExchange.identityMatcherValues[vendorUserIdIndex],
  };
};

const validatePresentation = (identityDoc, identityMatchers) => {
  const { rules } = identityMatchers;

  const rule = first(rules);

  const docValue = getJsonAtPath(first(rule.path), identityDoc);
  if (isEmpty(docValue)) {
    throw newError(
      400,
      PresentationErrors.PRESENTATION_JSON_PATH_MISSING(rule),
      { errorCode: 'presentation_credential_jsonpath_empty' }
    );
  }

  return { docValue, rule };
};

const evalRule = (docValue, { rule, valueIndex }, values) => {
  switch (rule) {
    case 'pick': {
      return includes(toLower(values[valueIndex]), toLower(docValue));
    }
    case 'all': {
      return (
        docValue.length > 0 &&
        every((val) => toLower(val) === toLower(values[valueIndex]), docValue)
      );
    }
    default: {
      throw newError.InternalServerError(
        PresentationErrors.INVALID_INTEGRATED_IDENTIFICATION_RULE
      );
    }
  }
};

module.exports = { matchIdentityOnExchange };
