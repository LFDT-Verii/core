const { isCaoService, isNodeOperator } = require('./is-service-category');
const { ConsentTypes } = require('../../registrar-consents');

const getServiceConsentType = (service) => {
  if (isCaoService(service)) {
    return ConsentTypes.CAO;
  }
  if (isNodeOperator(service)) {
    return ConsentTypes.NodeOperator;
  }
  return ConsentTypes.IssuerInspector;
};

module.exports = {
  getServiceConsentType,
};
